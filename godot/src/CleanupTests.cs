using System.Numerics;

namespace AsciiSurvivors;

public static partial class PortTests
{
    private static void CheckCleanup(Catalog c)
    {
        var g=Fixture(c);var alive=g.Spawn("brute",g.Player.Pos+new Vector2(60,0));alive.Hp=alive.MaxHp=1000000;alive.Speed=0;g.RebuildGrid();
        var shot=new Projectile{Weapon="needle",Pos=g.Player.Pos,Prev=g.Player.Pos,Velocity=new(600,0),Life=-1,Remaining=1,Damage=100,Radius=10};g.Shots.Add(shot);
        g.Pools.Add(new(){Pos=alive.Pos,Radius=80,Life=-1,Damage=100,Kind="water",Weapon="water"});g.Tick(1/60f);
        Check(g.Shots.Count==0&&g.Pools.Count==0&&alive.Hp==alive.MaxHp,"Expired shots and pools removed without ghost damage");
        var history=new Projectile{Life=2,Weapon="axe"};for(int i=10000;i<10100;i++)history.Hits[i]=100;history.Hits[alive.Id]=100;g.Shots.Add(history);g.CompactHitHistory();
        Check(history.Hits.Count==1&&history.Hits.ContainsKey(alive.Id),"Dead hit IDs freed while live no-repeat hit remains");
        g.HurtEnemy(alive,10000000);g.Tick(1/60f);Check(!g.Enemies.Contains(alive),"Killed bodies removed within the same simulation step");
        var crowd=Benchmarks.Scene(c,4000,true,false);int before=crowd.Enemies.Count;crowd.Ring("pulse",crowd.Player.Pos,150,.65f);Check(crowd.Visuals[^1].Life<=.18f,"High-load cosmetic ring expires quickly");
        crowd.Ring("",crowd.Player.Pos,150,.65f);Check(crowd.Visuals[^1].Life==.65f&&crowd.Enemies.Count==before,"Enemy warnings and live enemy population preserved");
    }
}
