using Godot;
using V=System.Numerics.Vector2;

namespace AsciiSurvivors;

public partial class MapView : Control
{
    public Simulation Game=null!;
    public Font Font=null!;
    public override void _Draw()
    {
        if(Game is null)return;var area=new Rect2(10,10,Size.X-20,Size.Y-20);DrawRect(area,new Color("14291c"));DrawRect(area,new Color("636f48"),false,2);
        Vector2 Point(V pos)=>area.Position+new Vector2(pos.X/World.Width*area.Size.X,pos.Y/World.Height*area.Size.Y);
        void Mark(V pos,string value,Color color){var p=Point(pos);DrawString(Font,p,value,HorizontalAlignment.Center,-1,18,color);}
        if(Game.MapId=="forest"){for(int x=0;x<=World.Width;x+=3200)DrawLine(Point(new(x,0)),Point(new(x,World.Height)),new Color("6c6e43"),4);for(int y=0;y<=World.Height;y+=2400)DrawLine(Point(new(0,y)),Point(new(World.Width,y)),new Color("6c6e43"),4);}
        if(!Game.Options.Sandbox)foreach(var t in Game.MapWorld.Treasures)if(!Game.TreasuresTaken.Contains(t.Id))Mark(t.Pos,"X",AsciiRenderer.Palette[7]);
        if(!Game.IsTest)foreach(var box in Game.MapWorld.Supplies)if(!Game.SuppliesTaken.Contains(box.Id))Mark(box.Pos,box.Kind=="heal"?"+":box.Kind=="level"?"^":"U",AsciiRenderer.Palette[box.Kind=="heal"?11:box.Kind=="level"?7:16]);
        foreach(var chest in Game.Chests)Mark(chest.Pos,"$",AsciiRenderer.Palette[5]);Mark(Game.Player.Pos,"@",AsciiRenderer.Palette[13]);
    }
}
