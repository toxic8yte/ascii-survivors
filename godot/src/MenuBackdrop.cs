using Godot;

namespace AsciiSurvivors;

public partial class MenuBackdrop : Control
{
    public static readonly string Castle=BuildCastle();
    private static string BuildCastle()
    {
        var grid=Enumerable.Range(0,9).Select(_=>Enumerable.Repeat(' ',41).ToArray()).ToArray();
        void Put(int x,int y,string value){value.CopyTo(0,grid[y],x,value.Length);}
        Put(20,0,"^");Put(19,1,"/ \\");Put(18,2,"/   \\");Put(5,1,"|>");Put(34,1,"<|");Put(5,2,"│");Put(35,2,"│");
        Put(2,3,"┌──┴──┐");Put(17,3,"┌─────┐");Put(32,3,"┌──┴──┐");
        for(int y=4;y<8;y++)foreach(int x in new[]{2,8,17,23,32,38})Put(x,y,"│");
        Put(8,4,"├────────┤");Put(23,4,"├────────┤");
        foreach(int x in new[]{5,20,35})Put(x,4,"█");foreach(int x in new[]{12,28})Put(x,5,"█");
        foreach(int y in new[]{6,7})foreach(var (x,n) in new[]{(3,5),(9,8),(24,8),(33,5)})Put(x,y,new string('░',n));
        Put(18,6,"┌───┐");Put(18,7,"│▓▓▓│");Put(0,8,new string('═',41));foreach(int x in new[]{2,8,17,18,22,23,32,38})Put(x,8,"╧");
        return string.Join('\n',grid.Select(row=>new string(row)));
    }
    public Font Font=null!;
    private double clock;
    public MenuBackdrop(){MouseFilter=MouseFilterEnum.Ignore;}
    public override void _Process(double delta){clock+=delta;if(clock>=.08){clock=0;QueueRedraw();}}
    private void Art(Vector2 at,string value,int size,Color color)
    {
        PseudoArt.DrawGrid(this,Font,at,value,size,color);
    }
    public override void _Draw()
    {
        if(Font is null)return;float w=Size.X,h=Size.Y;
        for(int i=0;i<32;i++){float t=i/31f;DrawRect(new Rect2(0,i*h/32,w,h/32+1),new Color(.055f+t*.035f,.045f+t*.015f,.042f+t*.012f));}
        var center=new Vector2(w/2,h*.42f);float radius=Math.Min(w,h)*.56f;
        for(int i=7;i>0;i--)DrawCircle(center,radius*i/7,new Color(.27f,.07f,.045f,.035f));
        const string tower="     ^     \n    / \\    \n   /   \\   \n  ┌─────┐  \n  │  █  │  \n┌─┼─────┼─┐\n│░│  █  │░│\n│ │     │ │\n│░│  █  │░│\n│ │     │ │\n│░│  █  │░│\n│ │     │ │\n╧═╧═════╧═╧";
        int towerSize=(int)Math.Clamp(w/65,16,28);float towerTop=h*.35f;
        Art(new(w*.055f,towerTop),tower,towerSize,new Color("514432"));Art(new(w*.83f,towerTop),tower,towerSize,new Color("454b39"));
        Art(new(w*.13f,h*.16f)," .---. \n/ ░░  \\\n\\ ░░  /\n '---' ",18,new Color("7d7653"));
        for(int i=0;i<55;i++)
        {
            float x=(i*773.13f)%Math.Max(w,1),y=(i*139.7f-(float)Time.GetTicksMsec()*.006f)%Math.Max(h,1);if(y<0)y+=h;
            DrawString(Font,new(x,y),i%3==0?"*":".",HorizontalAlignment.Left,-1,12,new Color(.6f,.38f,.17f,.22f+(float)Math.Sin(i+Time.GetTicksMsec()*.001)*.08f));
        }
        for(int i=0;i<12;i++){float x=i*w/11;Art(new(x,h-80-(i%3)*15),i%2==0?"  +  \n--|--\n _|_ ":" .-. \n | | \n_|_|_",15,new Color("2b3022"));}
    }
}
