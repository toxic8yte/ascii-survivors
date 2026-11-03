using Godot;

namespace AsciiSurvivors;

// Box-drawing strokes share cell edges; fallback-font metrics cannot break the walls.
public partial class PseudoArt : Control
{
    public Font Font=null!;
    public string Art="";
    public int CellHeight=14;
    public Color Ink=Colors.White;
    public PseudoArt(){MouseFilter=MouseFilterEnum.Ignore;}
    public static Vector2 Measure(string art,int height)
    {var lines=art.Split('\n');return new(lines.Max(l=>l.Length)*height*.6f,lines.Length*height);}
    public override Vector2 _GetMinimumSize()=>Measure(Art,CellHeight);
    public override void _Draw()=>DrawGrid(this,Font,Vector2.Zero,Art,CellHeight,Ink);
    public static void DrawGrid(Control canvas,Font font,Vector2 origin,string art,int height,Color color)
    {
        float width=height*.6f,stroke=Math.Max(1,height/20f);var lines=art.Split('\n');
        for(int row=0;row<lines.Length;row++)for(int col=0;col<lines[row].Length;col++)
        {
            char ch=lines[row][col];if(ch==' ')continue;
            var p=origin+new Vector2(col*width,row*height);var center=p+new Vector2(width/2,height/2f);
            int edges=ch switch{'─' or '═' or '-' or '='=>3,'│' or '║' or '|'=>12,'┌'=>10,'┐'=>9,'└'=>6,'┘'=>5,'├'=>14,'┤'=>13,'┬'=>11,'┴' or '╧'=>7,'┼'=>15,_=>0};
            if(edges!=0)
            {
                if((edges&1)!=0)canvas.DrawLine(center,new(p.X,center.Y),color,stroke);
                if((edges&2)!=0)canvas.DrawLine(center,new(p.X+width,center.Y),color,stroke);
                if((edges&4)!=0)canvas.DrawLine(center,new(center.X,p.Y),color,stroke);
                if((edges&8)!=0)canvas.DrawLine(center,new(center.X,p.Y+height),color,stroke);
                if(ch=='┌'&&row>0&&col+1<lines[row-1].Length&&lines[row-1][col+1]=='/')canvas.DrawLine(center,new(p.X+width,p.Y),color,stroke);
                if(ch=='┐'&&row>0&&col>0&&col-1<lines[row-1].Length&&lines[row-1][col-1]=='\\')canvas.DrawLine(center,p,color,stroke);
            }
            else if(ch is '░' or '▒' or '▓' or '█' or '▣')
            {
                var tint=color;tint.A*=ch=='░'?.18f:ch=='▒'?.35f:ch=='▓'?.6f:1;
                canvas.DrawRect(new Rect2(p+new Vector2(1,1),new(width-2,height-2)),tint);
            }
            else if(ch=='/')canvas.DrawLine(p+new Vector2(0,height),p+new Vector2(width,0),color,stroke);
            else if(ch=='\\')canvas.DrawLine(p,p+new Vector2(width,height),color,stroke);
            else if(ch=='^'){canvas.DrawLine(p+new Vector2(0,height),p+new Vector2(width/2,height/2f),color,stroke);canvas.DrawLine(p+new Vector2(width/2,height/2f),p+new Vector2(width,height),color,stroke);}
            else if(ch is '<' or '>')
            {
                float tip=ch=='>'?width:0,tail=width-tip;
                canvas.DrawLine(p+new Vector2(tail,height*.25f),p+new Vector2(tip,height/2f),color,stroke);canvas.DrawLine(p+new Vector2(tip,height/2f),p+new Vector2(tail,height*.75f),color,stroke);
            }
            else if(ch=='_')canvas.DrawLine(p+new Vector2(0,height),p+new Vector2(width,height),color,stroke);
            else
            {int size=Math.Max(8,height-2);string text=ch.ToString();float advance=font.GetStringSize(text,HorizontalAlignment.Left,-1,size).X;canvas.DrawString(font,new(p.X+(width-advance)/2,p.Y+font.GetAscent(size)),text,HorizontalAlignment.Left,-1,size,color);}
        }
    }
}
