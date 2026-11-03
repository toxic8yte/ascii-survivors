using System.Text.Json;

namespace AsciiSurvivors;

public static partial class PortTests
{
    private static void CheckTelemetry(Catalog c)
    {
        string dir=Path.Combine(Path.GetTempPath(),"ascii-survivors-tests",Guid.NewGuid().ToString("N"));
        var game=Fixture(c);game.Timings=new(){EnemiesMs=1,CrowdMs=2,WeaponsMs=3};
        using(var log=new Telemetry(dir))
        {
            log.Frame(game,2,.1,true,10,8,3,1920,1080);
            for(int i=0;i<8;i++){Thread.Sleep(150);log.Tick(7,game.Timings);log.Frame(game,2,.1,true,10,8,3,1920,1080,355,4);}
            log.Flush();Check(log.FilePath.Length>0&&File.Exists(log.FilePath),"Telemetry writes during active battle");
            var csv=File.ReadAllLines(log.FilePath);Check(csv.Length>=2&&csv[0].Split(',').Length==csv[1].Split(',').Length,"CSV invariant columns");
            Check(csv[0].EndsWith("batched_glyphs,glyph_packets")&&csv[1].EndsWith(",355,4"),"Telemetry records atlas batching counters");
            string summary=log.LastSummary;log.Frame(game,99,99,false,0,0,0,1920,1080);Check(log.LastSummary==summary,"Paused UI cannot replace last combat measurement");
            using var report=JsonDocument.Parse(File.ReadAllText(log.Export(game)));Check(report.RootElement.GetProperty("Seed").GetUInt32()==game.Seed&&report.RootElement.GetProperty("Levels").TryGetProperty("needle",out _),"Diagnostic export includes seed and loadout");
            Check(log.Error.Length==0,"Telemetry completed without I/O error");
        }
        Check(File.ReadAllLines(Directory.GetFiles(dir,"*.csv")[0]).Length>=2,"Telemetry remains readable after shutdown");
    }
}
