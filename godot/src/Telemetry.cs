using System.Diagnostics;
using System.Globalization;
using System.Text.Json;

namespace AsciiSurvivors;

public sealed class Telemetry : IDisposable
{
    private readonly string directory;
    private StreamWriter? writer;
    private readonly List<double> frames=new(256);
    private double elapsed,ticksMs,aiMs,crowdMs,weaponsMs,drawMs,audioMs;
    private int ticks,frameCount,rows;
    private long lastFrame;
    public string FilePath {get;private set;}="";
    public string DirectoryPath=>directory;
    public string LastSummary {get;private set;}="Ещё нет секунды измерений активного боя";
    public string Error {get;private set;}="";
    public Telemetry(string directory)=>this.directory=directory;
    public void Tick(double milliseconds,TickTimings timing)
    {ticks++;ticksMs+=milliseconds;aiMs+=timing.EnemiesMs;crowdMs+=timing.CrowdMs;weaponsMs+=timing.WeaponsMs;}
    public void Frame(Simulation game,double draw,double audio,bool active,int visible,int stamps,int voices,int width,int height)
    {
        long now=Stopwatch.GetTimestamp();double dt=lastFrame==0?0:Stopwatch.GetElapsedTime(lastFrame,now).TotalSeconds;lastFrame=now;
        if(!active){Reset();return;}if(dt<=0)return;
        elapsed+=dt;frameCount++;if(frames.Count<2048)frames.Add(dt*1000);drawMs+=draw;audioMs+=audio;
        if(elapsed<1)return;
        frames.Sort();double fps=frameCount/elapsed,p95=frames.Count>0?frames[(int)((frames.Count-1)*.95)]:0;
        double tick=ticksMs/Math.Max(1,ticks);long memory=WorkingMemory();
        LastSummary=$"БОЙ: {fps:0.0} FPS · кадр p95 {p95:0.00} мс · шаг {tick:0.00} мс · отрисовка CPU {drawMs/frameCount:0.00} мс";
        try
        {
            EnsureWriter();
            object[] values=[DateTime.UtcNow.ToString("O"),game.RunId,game.Time,game.Enemies.Count,visible,stamps,game.Shots.Count,game.EnemyShots.Count,game.Pools.Count,game.Blasts.Count,game.Visuals.Count,game.Gems.Count,game.Hearts.Count,fps,elapsed/frameCount*1000,p95,frames.Count>0?frames[^1]:0,ticks,tick,aiMs/Math.Max(1,ticks),crowdMs/Math.Max(1,ticks),weaponsMs/Math.Max(1,ticks),drawMs/frameCount,audioMs/frameCount,voices,memory,GC.GetTotalMemory(false),GC.CollectionCount(0),GC.CollectionCount(1),GC.CollectionCount(2),width,height,game.Kills,game.Level];
            writer!.WriteLine(string.Join(',',values.Select(v=>Convert.ToString(v,CultureInfo.InvariantCulture))));if(++rows%5==0)Flush();
        }
        catch(Exception e)when(e is IOException or UnauthorizedAccessException){Error=e.Message;Dispose();}
        Reset();
    }
    public static long WorkingMemory(){using var process=Process.GetCurrentProcess();return process.WorkingSet64;}
    private void Reset(){elapsed=ticksMs=aiMs=crowdMs=weaponsMs=drawMs=audioMs=0;ticks=frameCount=0;frames.Clear();}
    private void EnsureWriter()
    {
        if(writer is not null)return;Directory.CreateDirectory(directory);
        if(FilePath.Length==0)FilePath=Path.Combine(directory,"session-"+DateTime.UtcNow.ToString("yyyyMMdd-HHmmss")+"-"+Guid.NewGuid().ToString("N")[..6]+".csv");
        bool exists=File.Exists(FilePath);writer=new(FilePath,true);if(exists)return;
        writer.WriteLine("utc,run_id,game_seconds,enemies,visible,stamps,shots,enemy_shots,pools,blasts,visuals,gems,hearts,fps,frame_mean_ms,frame_p95_ms,frame_max_ms,physics_ticks,tick_mean_ms,ai_mean_ms,crowd_mean_ms,weapons_mean_ms,draw_cpu_mean_ms,audio_cpu_mean_ms,audio_voices,working_set_bytes,managed_bytes,gc0,gc1,gc2,viewport_width,viewport_height,kills,level");
        writer.Flush();
    }
    public string Export(Simulation game)
    {
        Directory.CreateDirectory(directory);Flush();
        string path=Path.Combine(directory,"snapshot-"+DateTime.UtcNow.ToString("yyyyMMdd-HHmmss")+"-"+Guid.NewGuid().ToString("N")[..6]+".json");
        var report=new{schema=1,utc=DateTime.UtcNow,build=typeof(Telemetry).Assembly.GetName().Version?.ToString(),runtime=Environment.Version.ToString(),os=Environment.OSVersion.ToString(),cpuThreads=Environment.ProcessorCount,game.RunId,game.Seed,game.RandomState,game.Time,game.Steps,game.HeroId,game.MapId,game.Options,game.Level,game.Kills,game.PeakEnemies,game.PressureOffset,game.Levels,game.Evolutions,enemies=game.Enemies.GroupBy(e=>e.Kind).ToDictionary(g=>g.Key,g=>g.Count()),game.Combat,summary=LastSummary,csv=Path.GetFileName(FilePath)};
        File.WriteAllText(path,JsonSerializer.Serialize(report,new JsonSerializerOptions(SaveStore.JsonOptions){WriteIndented=true,IgnoreReadOnlyProperties=false}));return path;
    }
    public void Flush()=>Dispose();
    public void Dispose(){var pending=writer;writer=null;try{pending?.Dispose();}catch(Exception e)when(e is IOException or UnauthorizedAccessException){Error=e.Message;}}
}
