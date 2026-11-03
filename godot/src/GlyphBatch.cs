using Godot;

namespace AsciiSurvivors;

// Godot shapes each distinct row once. Glyph bitmaps are copied into fixed-size
// atlas pages so later font-cache growth cannot invalidate stored UV coordinates.
internal sealed class GlyphBatch : IDisposable
{
    private const int PageSize=1024, MaxInstances=4096, Stride=16;
    private readonly TextServer server=TextServerManager.GetPrimaryInterface();
    private readonly Dictionary<(int,string),Row> rows=[];
    private readonly Dictionary<(Rid,int,int),Glyph> glyphs=[];
    private readonly List<Page> pages=[];
    private readonly List<Packet> packets=[];
    private readonly QuadMesh quad=new(){Size=Vector2.One};
    public readonly ShaderMaterial Material=new(){Shader=new Shader{Code="""
        shader_type canvas_item;
        render_mode unshaded;
        void vertex() {
            if (INSTANCE_CUSTOM.z > 0.0) {
                UV = INSTANCE_CUSTOM.xy + vec2(UV.x, 1.0 - UV.y) * INSTANCE_CUSTOM.zw;
            }
        }
        """}};
    private int packetIndex,count;
    private Page? currentPage;
    public int DrawCalls {get;private set;}
    public int GlyphCount {get;private set;}
    public int AtlasPages=>pages.Count;
    private readonly record struct Glyph(Page? Page,Vector2 Offset,Vector2 Size,Rect2 Uv);
    private readonly record struct PlacedGlyph(Glyph Glyph,Vector2 Offset);
    private sealed record Row(float Width,PlacedGlyph[] Glyphs);
    private sealed class Page : IDisposable
    {
        public readonly Image Image=Image.CreateEmpty(PageSize,PageSize,false,Image.Format.Rgba8);
        public readonly ImageTexture Texture;
        public int X=1,Y=1,Height;
        public bool Dirty;
        public Page(){Image.Fill(Colors.Transparent);Texture=ImageTexture.CreateFromImage(Image);}
        public bool Place(Vector2I size,out Vector2I pos)
        {
            if(X+size.X+1>PageSize){X=1;Y+=Height+2;Height=0;}
            pos=new(X,Y);if(Y+size.Y+1>PageSize)return false;
            X+=size.X+2;Height=Math.Max(Height,size.Y);return true;
        }
        public void Upload(){if(Dirty){Texture.Update(Image);Dirty=false;}}
        public void Dispose(){Texture.Dispose();Image.Dispose();}
    }
    private sealed class Packet : IDisposable
    {
        public readonly MultiMesh Mesh;
        public float[] Buffer=[];
        public Packet(QuadMesh quad){Mesh=new(){TransformFormat=MultiMesh.TransformFormatEnum.Transform2D,UseColors=true,UseCustomData=true,Mesh=quad};}
        public void Reserve(int count)
        {
            if(Buffer.Length>=count*Stride)return;
            int capacity=Math.Min(MaxInstances,Math.Max(64,Buffer.Length/Stride*2));
            Array.Resize(ref Buffer,capacity*Stride);Mesh.InstanceCount=capacity;
        }
        public void Dispose()=>Mesh.Dispose();
    }
    public void Begin(){packetIndex=count=DrawCalls=GlyphCount=0;currentPage=null;}
    private Glyph GetGlyph(Rid font,int size,int index)
    {
        var key=(font,size,index);if(glyphs.TryGetValue(key,out var glyph))return glyph;
        var cacheSize=new Vector2I(size,0);
        // Ensures the CPU font atlas has rasterized this glyph before copying it.
        server.FontGetGlyphTextureRid(font,cacheSize,index);
        Vector2 extent=server.FontGetGlyphSize(font,cacheSize,index),offset=server.FontGetGlyphOffset(font,cacheSize,index);
        if(extent.X<=0||extent.Y<=0)return glyphs[key]=new(null,offset,extent,default);
        Rect2 sourceRect=server.FontGetGlyphUVRect(font,cacheSize,index);
        var pixels=new Vector2I((int)sourceRect.Size.X,(int)sourceRect.Size.Y);
        if(pixels.X+2>PageSize||pixels.Y+2>PageSize)throw new InvalidOperationException("ASCII glyph exceeds atlas page");
        Page page;Vector2I target;
        if(pages.Count==0||!pages[^1].Place(pixels,out target)){page=new();pages.Add(page);page.Place(pixels,out target);}else page=pages[^1];
        using var source=server.FontGetTextureImage(font,cacheSize,server.FontGetGlyphTextureIdx(font,cacheSize,index));
        using var rgba=(Image)source.Duplicate();rgba.Convert(Image.Format.Rgba8);
        page.Image.BlitRect(rgba,new Rect2I((Vector2I)sourceRect.Position,pixels),target);page.Dirty=true;
        return glyphs[key]=new(page,offset,extent,new Rect2((Vector2)target/PageSize,(Vector2)pixels/PageSize));
    }
    private Row Shape(Font font,int size,string value)
    {
        var key=(size,value);if(rows.TryGetValue(key,out var row))return row;
        if(rows.Count>=4096)rows.Clear();
        using var line=new TextLine();line.AddString(value,font,size);
        float width=line.GetSize().X,advance=0,ascent=line.GetLineAscent();var placed=new List<PlacedGlyph>();
        foreach(var item in server.ShapedTextGetGlyphs(line.GetRid()))
        {
            var rid=item["font_rid"].AsRid();int fontSize=item["font_size"].AsInt32(),index=item["index"].AsInt32();
            int repeat=item["repeat"].AsInt32();float step=item["advance"].AsSingle();
            Glyph glyph=rid.IsValid?GetGlyph(rid,fontSize,index):default;
            for(int i=0;i<repeat;i++)
            {
                if(glyph.Page is not null)placed.Add(new(glyph,new Vector2(advance,ascent)+item["offset"].AsVector2()));
                advance+=step;
            }
        }
        return rows[key]=new(width,placed.ToArray());
    }
    public void Text(Rid canvas,Font font,Vector2 pos,string value,int size,Color color,bool center)
    {
        var row=Shape(font,size,value);if(center)pos.X-=row.Width/2;
        foreach(var placed in row.Glyphs)
        {
            var glyph=placed.Glyph;var page=glyph.Page!;
            if(currentPage!=page||count==MaxInstances)Flush(canvas);
            currentPage=page;if(packetIndex==packets.Count)packets.Add(new(quad));var packet=packets[packetIndex];packet.Reserve(count+1);
            int at=count++*Stride;var p=(pos+placed.Offset+glyph.Offset).Round()+glyph.Size/2;var b=packet.Buffer;
            b[at]=glyph.Size.X;b[at+1]=b[at+2]=0;b[at+3]=p.X;
            b[at+4]=0;b[at+5]=glyph.Size.Y;b[at+6]=0;b[at+7]=p.Y;
            b[at+8]=color.R;b[at+9]=color.G;b[at+10]=color.B;b[at+11]=color.A;
            b[at+12]=glyph.Uv.Position.X;b[at+13]=glyph.Uv.Position.Y;b[at+14]=glyph.Uv.Size.X;b[at+15]=glyph.Uv.Size.Y;
            GlyphCount++;
        }
    }
    public void Flush(Rid canvas)
    {
        if(count==0)return;var packet=packets[packetIndex++];currentPage!.Upload();
        packet.Mesh.Buffer=packet.Buffer;packet.Mesh.VisibleInstanceCount=count;
        RenderingServer.CanvasItemAddMultimesh(canvas,packet.Mesh.GetRid(),currentPage.Texture.GetRid());
        count=0;currentPage=null;DrawCalls++;
    }
    public void Dispose()
    {
        foreach(var packet in packets)packet.Dispose();foreach(var page in pages)page.Dispose();
        packets.Clear();pages.Clear();rows.Clear();glyphs.Clear();quad.Dispose();Material.Shader.Dispose();Material.Dispose();
    }
}
