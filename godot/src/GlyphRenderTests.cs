using Godot;

namespace AsciiSurvivors;

public partial class Main
{
    private async Task CheckGlyphRenderer(string directory,string tag)
    {
        using var batch=new GlyphBatch();var probe=new Node2D();AddChild(probe);
        string ascii=new(Enumerable.Range(33,94).Select(i=>(char)i).ToArray());
        string[] samples=[ascii[..47],ascii[47..],"ASCII  /\\ | _ - + (v v) \\W/  ЖЁЧ Э эволюция"];
        var lines=new List<(TextLine Line,string Value,int Size)>();
        foreach(int size in new[]{11,13,16,32})foreach(string sample in samples){string value=size==32?sample[..20]:sample;var line=new TextLine();line.AddString(value,renderer.Font,size);lines.Add((line,value,size));}
        probe.Draw+=()=>
        {
            probe.Material=renderer.UseGlyphBatch?batch.Material:null;batch.Begin();
            var origin=renderer.Field.GetCenter()-new Vector2(250,185);probe.DrawRect(new Rect2(origin-new Vector2(8,8),new(510,370)),new Color("10291c"));
            for(int i=0;i<lines.Count;i++)
            {
                var row=lines[i];var point=origin+new Vector2(.3f+i*.13f,i*25.1f+Math.Max(0,i-8)*12);var color=AsciiRenderer.Palette[4+i];color.A=i%2==0?1:.6f;
                if(renderer.UseGlyphBatch)batch.Text(probe.GetCanvasItem(),renderer.Font,point,row.Value,row.Size,color,false);
                else row.Line.Draw(probe.GetCanvasItem(),point,color);
            }
            batch.Flush(probe.GetCanvasItem());
        };
        async Task<Image> Capture(bool batch)
        {
            renderer.UseGlyphBatch=batch;renderer.Camera=game.Player.Pos;probe.QueueRedraw();
            for(int i=0;i<4;i++)await ToSignal(GetTree(),SceneTree.SignalName.ProcessFrame);
            await ToSignal(RenderingServer.Singleton,RenderingServer.SignalName.FramePostDraw);
            return GetViewport().GetTexture().GetImage();
        }
        try
        {
        using var legacy=await Capture(false);using var batched=await Capture(true);
        legacy.SavePng(Path.Combine(directory,"glyph-legacy-"+tag+".png"));batched.SavePng(Path.Combine(directory,"glyph-batch-"+tag+".png"));
        if(legacy.GetSize()!=batched.GetSize()||renderer.BatchedGlyphs==0||renderer.GlyphDrawCalls==0||renderer.GlyphDrawCalls>=renderer.BatchedGlyphs)
            throw new Exception("Glyph renderer did not batch visible symbols");
        var a=legacy.GetData();var b=batched.GetData();double difference=0;for(int i=0;i<a.Length;i++)difference+=Math.Abs(a[i]-b[i]);
        double mean=difference/a.Length;
        // A one-pixel neighborhood tolerates text-server pixel snapping, but rejects flipped or missing glyphs.
        double GlyphError(Image candidate)
        {
        float scale=legacy.GetWidth()/root.Size.X;var origin=(renderer.Field.GetCenter()-new Vector2(250,185))*scale;double mismatch=0;int foreground=0;
        for(int y=Math.Max(1,(int)origin.Y);y<Math.Min(legacy.GetHeight()-1,origin.Y+350*scale);y++)
        for(int x=Math.Max(1,(int)origin.X);x<Math.Min(legacy.GetWidth()-1,origin.X+490*scale);x++)
        {
            var expected=legacy.GetPixel(x,y);if(Math.Max(expected.R,Math.Max(expected.G,expected.B))<.25f)continue;
            float best=1;
            for(int dy=-1;dy<=1;dy++)for(int dx=-1;dx<=1;dx++)
            {var actual=candidate.GetPixel(x+dx,y+dy);best=Math.Min(best,Math.Max(Math.Abs(expected.R-actual.R),Math.Max(Math.Abs(expected.G-actual.G),Math.Abs(expected.B-actual.B))));}
            mismatch+=best;foreground++;
        }
        return foreground==0?1:mismatch/foreground;
        }
        double error=GlyphError(batched);
        GD.Print($"GLYPH comparison {tag}: mean byte difference {mean:0.000}, glyph error {error:0.000}; {renderer.BatchedGlyphs} glyphs / {renderer.GlyphDrawCalls} packets");
        if(mean>1||error>.06)throw new Exception($"Batched glyph image differs from reference text rendering: {mean}, glyph error {error}");
        if(tag=="normal")
        {
            batch.Material.Shader.Code=batch.Material.Shader.Code.Replace("1.0 - UV.y","UV.y");
            using var flipped=await Capture(true);double flippedError=GlyphError(flipped);
            GD.Print($"GLYPH negative control (flipped): {flippedError:0.000}");
            if(flippedError<=.06)throw new Exception("Glyph comparison failed to detect deliberately flipped symbols");
        }
        }
        finally{probe.Free();foreach(var row in lines)row.Line.Dispose();renderer.UseGlyphBatch=true;}
    }
}
