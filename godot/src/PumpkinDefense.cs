using System.Numerics;

namespace AsciiSurvivors;

public sealed partial class Simulation
{
    [System.Text.Json.Serialization.JsonIgnore] private readonly Dictionary<int,List<Projectile>> defenseGrid=[];
    [System.Text.Json.Serialization.JsonIgnore] private readonly Stack<List<Projectile>> defensePool=[];
    [System.Text.Json.Serialization.JsonIgnore] private long defenseStep=-1;
    private void IndexDefense()
    {
        if(defenseStep==Steps)return;defenseStep=Steps;
        foreach(var cell in defenseGrid.Values){cell.Clear();defensePool.Push(cell);}defenseGrid.Clear();
        foreach(var s in Shots)
        {
            if(L(s.Weapon)<1||s.Life<=0||s.Remaining<=0||s.ChargeLeft>0)continue;
            int minX=(int)MathF.Floor((Math.Min(s.Prev.X,s.Pos.X)-s.Radius)/80),maxX=(int)MathF.Floor((Math.Max(s.Prev.X,s.Pos.X)+s.Radius)/80),minY=(int)MathF.Floor((Math.Min(s.Prev.Y,s.Pos.Y)-s.Radius)/80),maxY=(int)MathF.Floor((Math.Max(s.Prev.Y,s.Pos.Y)+s.Radius)/80);
            for(int y=minY;y<=maxY;y++)for(int x=minX;x<=maxX;x++)
            {int key=x+y*1024;if(!defenseGrid.TryGetValue(key,out var cell))defenseGrid[key]=cell=defensePool.Count>0?defensePool.Pop():[];cell.Add(s);}
        }
    }
    public bool DeflectPumpkin(Projectile shot,int minimumRank=3,bool feedback=true)
    {
        if(shot.Weapon!="pumpkin")return false;
        bool Ready(string id)=>L(id)>=minimumRank;
        bool Point(Vector2 pos,float radius)=>World.SegmentDistance(pos,shot.Prev,shot.Pos)<=radius+shot.Radius;
        bool Path(Vector2 a,Vector2 b,float width)
        {
            var d=b-a;var v=shot.Pos-shot.Prev;float cross=d.X*v.Y-d.Y*v.X;
            if(Math.Abs(cross)>.0001f){var offset=shot.Prev-a;float t=(offset.X*v.Y-offset.Y*v.X)/cross,u=(offset.X*d.Y-offset.Y*d.X)/cross;if(t>=0&&t<=1&&u>=0&&u<=1)return true;}
            return Point(a,width)||Point(b,width)||World.SegmentDistance(shot.Pos,a,b)<=width+shot.Radius||World.SegmentDistance(shot.Prev,a,b)<=width+shot.Radius;
        }
        bool blocked=false;
        // Index friendly swept hitboxes once per tick instead of scanning every projectile for each pumpkin ball.
        IndexDefense();
        int minX=(int)MathF.Floor((Math.Min(shot.Prev.X,shot.Pos.X)-shot.Radius)/80),maxX=(int)MathF.Floor((Math.Max(shot.Prev.X,shot.Pos.X)+shot.Radius)/80),minY=(int)MathF.Floor((Math.Min(shot.Prev.Y,shot.Pos.Y)-shot.Radius)/80),maxY=(int)MathF.Floor((Math.Max(shot.Prev.Y,shot.Pos.Y)+shot.Radius)/80);
        for(int y=minY;y<=maxY&&!blocked;y++)for(int x=minX;x<=maxX&&!blocked;x++)if(defenseGrid.TryGetValue(x+y*1024,out var cell))foreach(var s in cell)if(Ready(s.Weapon)&&s.Life>0&&s.Remaining>0&&Path(s.Prev,s.Pos,s.Radius)){blocked=true;break;}
        if(!blocked)foreach(var pool in Pools)if(Ready(pool.Weapon)&&pool.Life>0&&Point(pool.Pos,pool.Radius)){blocked=true;break;}
        if(!blocked&&Ready("blades"))blocked=BladePositions().Any(pos=>Point(pos,19*Area));
        if(!blocked&&Ready("bible"))blocked=BiblePositions().Any(pos=>Point(pos,20*Area));
        if(!blocked&&Ready("garlic")&&!Manual)blocked=Point(Player.Pos,(75+L("garlic")*15)*Area*(Evolved("garlic")?1.4f:1));
        if(!blocked)foreach(var v in Visuals)
        {
            if(!Ready(v.Weapon)||v.Life<=0)continue;
            if(v.Points.Length>1){for(int i=1;i<v.Points.Length;i++)if(Path(v.Points[i-1],v.Points[i],v.Shape=="whip"?14*Area:22)){blocked=true;break;}}
            else if(v.Shape is "slash" or "crowbar" or "fist")
            {var delta=shot.Pos-v.Pos;blocked=Point(v.Pos,v.Radius)&&Math.Abs(World.AngleDelta(World.Angle(delta)-v.Angle))<=v.HalfAngle;}
            else blocked=Point(v.Pos,v.Radius);
            if(blocked)break;
        }
        if(blocked&&feedback){Visuals.Add(new(){Weapon="",Shape="ring",Pos=shot.Pos,Radius=12,Life=.12f,MaxLife=.12f,Ink=7,Glyph="×"});SoundSignals|=SoundCue.Shield;}
        return blocked;
    }
}
