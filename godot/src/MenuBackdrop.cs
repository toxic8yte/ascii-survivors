using Godot;

namespace AsciiSurvivors;

public partial class MenuBackdrop : Control
{
    public Font Font=null!;
    private double clock;
    public MenuBackdrop(){MouseFilter=MouseFilterEnum.Ignore;}
    public override void _Process(double delta){clock+=delta;if(clock>=.08){clock=0;QueueRedraw();}}
    private void Art(Vector2 at,string value,int size,Color color)
    {
        foreach(var line in value.Split('\n')){DrawString(Font,at,line,HorizontalAlignment.Left,-1,size,color);at.Y+=size*1.18f;}
    }
    public override void _Draw()
    {
        if(Font is null)return;float w=Size.X,h=Size.Y;
        for(int i=0;i<32;i++){float t=i/31f;DrawRect(new Rect2(0,i*h/32,w,h/32+1),new Color(.055f+t*.035f,.045f+t*.015f,.042f+t*.012f));}
        var center=new Vector2(w/2,h*.42f);float radius=Math.Min(w,h)*.56f;
        for(int i=7;i>0;i--)DrawCircle(center,radius*i/7,new Color(.27f,.07f,.045f,.035f));
        const string left="        _____        \n     .-'     '-.     \n    /  _     _  \\    \n   |  (x)   (x)  |   \n   |      ^      |   \n    \\  .---.  /     \n     '-.|_|_.-'      \n       /| |\\        \n     _/ | | \\_      \n   _/   | |   \\_    \n  /_____|_|_____\\   ";
        const string right="       /\\        \n      /  \\       \n     / .. \\      \n    /  __  \\     \n   /___||___\\    \n      /||\\       \n    _/ || \\_     \n   /   ||   \\    \n  /    ||    \\   \n /____/  \\____\\  ";
        Art(new(w*.09f,h*.3f),left,20,new Color("634534"));Art(new(w*.78f,h*.31f),right,22,new Color("4f5140"));
        for(int i=0;i<55;i++)
        {
            float x=(i*773.13f)%Math.Max(w,1),y=(i*139.7f-(float)Time.GetTicksMsec()*.006f)%Math.Max(h,1);if(y<0)y+=h;
            DrawString(Font,new(x,y),i%3==0?"*":".",HorizontalAlignment.Left,-1,12,new Color(.6f,.38f,.17f,.22f+(float)Math.Sin(i+Time.GetTicksMsec()*.001)*.08f));
        }
        for(int i=0;i<12;i++){float x=i*w/11;Art(new(x,h-80-(i%3)*15),i%2==0?"  +  \n--|--\n _|_ ":" .-. \n | | \n_|_|_",15,new Color("2b3022"));}
    }
}
