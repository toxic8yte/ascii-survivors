using System.Numerics;
using System.Text.Json;

namespace AsciiSurvivors;

public static partial class PortTests
{
    private static void CheckCrowd(Catalog c)
    {
        bool identical=true;
        foreach(int size in Enumerable.Range(1,128).Concat(new[]{511,6000,24000}))
        foreach(int start in new[]{0,size/2,size-1})for(int i=0;i<Math.Min(4,size);i++)
            identical&=Simulation.CrowdSampleIndex(size,start,i)==(start+(int)((long)i*size/Math.Min(4,size)))%size;
        Check(identical,"Fast cell sampling visits exactly the same neighbors without per-candidate division");
        var g=new Simulation(c,781,new(){Sandbox=true,Enemy="dummy",Manual=true});g.Start();g.Enemies.Clear();g.Timings=new();
        var center=g.Player.Pos+new Vector2(100,0);var a=g.Spawn("brute",center);var b=g.Spawn("brute",center);a.Speed=b.Speed=0;
        g.Tick(1/60f);Check(Vector2.Distance(a.Pos,b.Pos)>1,"Crowd separates coincident bodies");Close(Vector2.Distance((a.Pos+b.Pos)/2,center),0,"Isolated pair has no center drift",.001f);
        Check(g.Timings.CrowdMoves==2,"One constrained move per separated body");
        Check(!JsonSerializer.Serialize(g,SaveStore.JsonOptions).Contains("CrowdPosition"),"Transient separation scratch is excluded from saves");
        var settling=Benchmarks.Scene(c,256,true,false,true,true);
        foreach(var e in settling.Enemies){e.Speed=0;e.FrozenUntil=settling.Time+10;}
        float Penetration()
        {
            float total=0;for(int i=0;i<settling.Enemies.Count;i++)for(int j=0;j<i;j++)
            {var x=settling.Enemies[i];var y=settling.Enemies[j];total+=Math.Max(0,(x.Radius+y.Radius)*.7f-Vector2.Distance(x.Pos,y.Pos));}
            return total;
        }
        float before=Penetration();for(int i=0;i<60;i++)settling.Tick(1/60f);
        Check(Penetration()<before*.8f,"Repeated accumulated separation reduces crowd penetration");
        foreach(int count in new[]{512,6000})
        {
            var crowd=Benchmarks.Scene(c,count,true,false,true,true);foreach(var e in crowd.Enemies){e.Pos=e.Prev=crowd.Player.Pos+new Vector2(80,0);e.Speed=0;}
            crowd.RebuildGrid();crowd.Tick(1/60f);
            Check(crowd.Enemies.Count==count&&crowd.Timings!.CrowdMoves is >0&&crowd.Timings.CrowdMoves<=count,"Dense separation keeps every body and bounds constrained moves");
            Check(crowd.Enemies.All(e=>float.IsFinite(e.Pos.X+e.Pos.Y)&&Vector2.Distance(e.Pos,e.Prev)<=24.01f),"Dense separation cannot explode positions");
            Check(crowd.Enemies.Select(e=>e.Pos).Distinct().Count()>1,"Dense mixed crowd actually separates");
        }
        var forest=Fixture(c);forest.Timings=new();var tree=forest.MapWorld.Cells.OfType<Obstacle>().First(b=>Vector2.Distance(b.Pos,forest.Player.Pos) is >300 and <600);
        var edge=tree.Pos+new Vector2(tree.Size.X/2+29,0);
        var left=forest.Spawn("brute",edge);var right=forest.Spawn("brute",edge+new Vector2(1,0));left.Speed=right.Speed=0;
        forest.RebuildGrid();for(int i=0;i<30;i++)forest.Tick(1/60f);
        Check(new[]{left,right}.All(e=>{var pos=e.Pos;return !forest.MapWorld.Resolve(ref pos,e.Radius,forest.Arena);}),"Accumulated crowd pushes respect solid trees");
        var ring=new Simulation(c,781,new(){Sandbox=true,Enemy="lichLord",Manual=true});ring.Start();ring.Timings=new();ring.Player.Invulnerable=100;
        var inside=ring.Spawn("brute",ring.Arena!.Pos+new Vector2(150,0),1);var outside=ring.Spawn("brute",ring.Arena.Pos+new Vector2(250,0));inside.Speed=outside.Speed=0;
        for(int i=0;i<30;i++)ring.Tick(1/60f);
        Check(Vector2.Distance(inside.Pos,ring.Arena.Pos)<=ring.Arena.Radius-inside.Radius-8+.01f&&Vector2.Distance(outside.Pos,ring.Arena.Pos)>=ring.Arena.Radius+outside.Radius+8-.01f,"Crowd cannot push enemies through boss wall");
    }
}
