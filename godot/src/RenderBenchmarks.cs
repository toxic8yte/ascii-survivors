using Godot;

namespace AsciiSurvivors;

public partial class Main
{
    private async Task RenderBenchmarks(string directory)
    {
        try
        {
            Directory.CreateDirectory(directory);DisplayServer.WindowSetVsyncMode(DisplayServer.VSyncMode.Disabled);DisplayServer.WindowSetSize(new(1920,1080));
            var rows=new List<object>();
            foreach(bool dense in new[]{false,true})foreach(int count in new[]{1000,5000,10000})
            {
                CloseOverlay();game=Benchmarks.Scene(content,count,dense,false);game.Status=RunStatus.Paused;renderer.Game=game;renderer.Camera=game.Player.Pos;RefreshHud(true);
                for(int i=0;i<12;i++)await ToSignal(GetTree(),SceneTree.SignalName.ProcessFrame);
                var frames=new List<double>();double draw=0;
                for(int i=0;i<48;i++){await ToSignal(GetTree(),SceneTree.SignalName.ProcessFrame);frames.Add(GetProcessDeltaTime()*1000);draw+=renderer.LastDrawMs;}
                frames.Sort();rows.Add(new{count,dense,frameMs=frames.Average(),p95Ms=frames[(int)(frames.Count*.95)],drawCpuMs=draw/48,visible=renderer.VisibleEnemies,drawn=renderer.RenderedEnemies});
                if(game.Enemies.Count!=count||renderer.VisibleEnemies<renderer.RenderedEnemies)throw new InvalidOperationException("Render benchmark lost enemies");
                GD.Print($"RENDER {count} {(dense?"dense":"spread")}: {frames.Average():0.00} ms/frame, draw CPU {draw/48:0.00} ms; {renderer.VisibleEnemies} visible, {renderer.RenderedEnemies} stamps");
            }
            CloseOverlay();game=Benchmarks.Scene(content,5000,true,true);renderer.Game=game;renderer.Camera=game.Player.Pos;RefreshHud(true);
            for(int i=0;i<100;i++)await ToSignal(GetTree(),SceneTree.SignalName.ProcessFrame);
            var live=new List<double>();for(int i=0;i<1800;i++){await ToSignal(GetTree(),SceneTree.SignalName.ProcessFrame);live.Add(GetProcessDeltaTime()*1000);}
            live.Sort();rows.Add(new{live=true,count=game.Enemies.Count,arsenal=true,samples=live.Count,simulatedSeconds=game.Time-900,frameMs=live.Average(),p95Ms=live[(int)(live.Count*.95)],visible=renderer.VisibleEnemies,drawn=renderer.RenderedEnemies});
            if(game.Enemies.Count!=5000)throw new InvalidOperationException("Live benchmark lost enemies");
            GD.Print($"LIVE {game.Enemies.Count} all weapons: {live.Average():0.00} ms/frame, p95 {live[(int)(live.Count*.95)]:0.00}; {game.Time-900:0.00} simulated seconds");
            await ToSignal(RenderingServer.Singleton,RenderingServer.SignalName.FramePostDraw);using(var snapshot=GetViewport().GetTexture().GetImage())snapshot.SavePng(Path.Combine(directory,"live-5000.png"));
            File.WriteAllText(Path.Combine(directory,"render.json"),System.Text.Json.JsonSerializer.Serialize(rows,new System.Text.Json.JsonSerializerOptions{WriteIndented=true}));GetTree().Quit();
        }
        catch(Exception e){GD.PushError(e.ToString());GetTree().Quit(1);}
    }
}
