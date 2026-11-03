using System.Diagnostics;
using System.Numerics;
using System.Text.Json;

namespace AsciiSurvivors;

public sealed class TickTimings {public double EnemiesMs,CrowdMs,WeaponsMs;public int CrowdCandidates;}

public static class Benchmarks
{
    public static Simulation Scene(Catalog content,int count,bool dense,bool arsenal,bool mixed=false)
    {
        var game=new Simulation(content,781,new(){Sandbox=true,Stress=arsenal,Invulnerable=true,Rank=4,EnemyLimit=24000});game.Start();game.Enemies.Clear();game.Elapsed=900;game.Timings=new();
        foreach(string key in game.Clocks.Keys.ToArray())game.Clocks[key]=0;
        string[] kinds=["brute","skeleton","ghoul","bat","pumpkin","mummy"];string elite=content.Enemies.First(e=>e.Value.Rank=="elite"&&e.Value.Ai=="chase").Key;
        for(int i=0;i<count;i++)
        {
            float angle=i*2.399963f,radius=(dense?60:140)+MathF.Sqrt((i+.5f)/count)*(dense?100:800);
            var enemy=game.Spawn(mixed?(i%8==7?elite:kinds[i%kinds.Length]):"brute",game.Player.Pos+World.Direction(angle)*radius);enemy.Hp=enemy.MaxHp=100000000;
        }
        game.RebuildGrid();return game;
    }
    public static void Run(Catalog content,string output)
    {
        var rows=new List<object>();
        foreach(bool dense in new[]{false,true})foreach(int count in new[]{1000,5000,10000})
        {
            var game=Scene(content,count,dense,false);for(int i=0;i<3;i++)game.Tick(1/60f);
            var frames=new List<double>();double enemies=0,crowd=0,weapons=0;long allocated=GC.GetAllocatedBytesForCurrentThread();
            for(int i=0;i<12;i++)
            {
                long start=Stopwatch.GetTimestamp();game.Tick(1/60f);frames.Add(Stopwatch.GetElapsedTime(start).TotalMilliseconds);
                enemies+=game.Timings!.EnemiesMs;crowd+=game.Timings.CrowdMs;weapons+=game.Timings.WeaponsMs;
            }
            double bytes=(GC.GetAllocatedBytesForCurrentThread()-allocated)/12d;frames.Sort();
            rows.Add(new{count,dense,meanMs=frames.Average(),p95Ms=frames[^1],enemiesMs=enemies/12,crowdMs=crowd/12,weaponsMs=weapons/12,bytesPerTick=bytes});
            Console.WriteLine($"{count} {(dense?"dense":"spread")}: {frames.Average():0.00} ms/tick; crowd {crowd/12:0.00}, weapons {weapons/12:0.00}; {bytes/1024:0.0} KB/tick");
        }
        Directory.CreateDirectory(Path.GetDirectoryName(output)!);File.WriteAllText(output,JsonSerializer.Serialize(rows,new JsonSerializerOptions{WriteIndented=true}));
    }
}
