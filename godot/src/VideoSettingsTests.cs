using Godot;

namespace AsciiSurvivors;

public static partial class PortTests
{
    private static void CheckVideoSettings()
    {
        string dir=Path.Combine(Path.GetTempPath(),"ascii-survivors-tests",Guid.NewGuid().ToString("N")),path=Path.Combine(dir,"video.cfg");
        var settings=new VideoSettings(path);Check(settings.Fps==240&&!settings.VSync,"Default video unlocks refresh rate with a 240 FPS ceiling");
        foreach(int limit in new[]{60,120,240,0})foreach(bool sync in new[]{false,true})
        {settings.Set(limit,sync);Check(settings.Save()==Error.Ok,"Video settings saved");var loaded=new VideoSettings(path);Check(loaded.Fps==limit&&loaded.VSync==sync,"FPS and VSync persist independently");}
        foreach(var invalid in new Variant[]{-1,500,240.0,"120",true,long.MaxValue})
        {
            using var file=new ConfigFile();file.SetValue("video","fps_limit",invalid);file.SetValue("video","vsync","true");file.Save(path);
            var loaded=new VideoSettings(path);Check(loaded.Fps==240&&!loaded.VSync,"Malformed video values fall back safely");
        }
        File.WriteAllText(path,"broken config [");Check(new VideoSettings(path).Fps==240,"Damaged config cannot stop startup");
        bool rejected=false;try{settings.Set(90,false);}catch(ArgumentOutOfRangeException){rejected=true;}Check(rejected,"Only supported FPS limits accepted");
        string blocked=Path.Combine(dir,"file");File.WriteAllText(blocked,"preserve");Check(new VideoSettings(Path.Combine(blocked,"video.cfg")).Save()!=Error.Ok&&File.ReadAllText(blocked)=="preserve","Video save failure preserves existing files");
    }
}

public partial class Main
{
    private async Task CheckRenderInterpolation()
    {
        var fractions=new HashSet<float>();
        for(int i=0;i<24;i++){await ToSignal(GetTree(),SceneTree.SignalName.ProcessFrame);fractions.Add(renderer.Interpolation);}
        if(!fractions.Any(f=>f>0&&f<1)||fractions.Count<4)throw new Exception("High-refresh rendering did not interpolate physics steps");
        game.Status=RunStatus.Paused;for(int i=0;i<3;i++)await ToSignal(GetTree(),SceneTree.SignalName.ProcessFrame);
        if(renderer.Interpolation!=1)throw new Exception("Paused scene shows an old interpolated pose");
    }
    private async Task CheckVideoSettingsUi(string directory)
    {
        var selector=overlay.FindChildren("FpsLimit","OptionButton",true,false).Cast<OptionButton>().Single();
        var sync=overlay.FindChildren("VSync","CheckButton",true,false).Cast<CheckButton>().Single();
        foreach(var (index,limit) in new[]{(0,60),(1,120),(2,240),(3,0)})
        {
            sync.ButtonPressed=false;selector.Select(index);selector.EmitSignal(OptionButton.SignalName.ItemSelected,index);
            if(Engine.MaxFps!=limit||video.Fps!=limit||Engine.PhysicsTicksPerSecond!=60||DisplayServer.WindowGetVsyncMode()!=DisplayServer.VSyncMode.Disabled)
                throw new Exception("FPS selection did not apply independently of physics/VSync");
            for(int i=0;i<8;i++)await ToSignal(GetTree(),SceneTree.SignalName.ProcessFrame);
            int frames=0;long started=System.Diagnostics.Stopwatch.GetTimestamp();
            while(System.Diagnostics.Stopwatch.GetElapsedTime(started).TotalSeconds<.6){await ToSignal(GetTree(),SceneTree.SignalName.ProcessFrame);frames++;}
            double fps=frames/System.Diagnostics.Stopwatch.GetElapsedTime(started).TotalSeconds;
            if(limit>0&&fps>limit*1.12||limit>=120&&fps<limit*.65||limit==0&&fps<=70)throw new Exception($"FPS control failed: limit {limit}, measured {fps:0.0}");
            var loaded=new VideoSettings(Path.Combine(directory,"video.cfg"));if(loaded.Fps!=limit||loaded.VSync)throw new Exception("FPS setting did not survive reload");
            GD.Print($"FPS limit {limit}: {fps:0.0} measured");
        }
        sync.ButtonPressed=true;
        if(DisplayServer.WindowGetVsyncMode()!=DisplayServer.VSyncMode.Enabled||!new VideoSettings(Path.Combine(directory,"video.cfg")).VSync)throw new Exception("VSync checkbox did not apply/persist");
        selector.Select(2);selector.EmitSignal(OptionButton.SignalName.ItemSelected,2);sync.ButtonPressed=false;
        var restored=new VideoSettings(Path.Combine(directory,"video.cfg"));restored.Apply();
        if(Engine.MaxFps!=240||restored.VSync)throw new Exception("Saved video settings did not apply on reload");
    }
}
