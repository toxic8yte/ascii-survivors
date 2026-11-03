using Godot;

namespace AsciiSurvivors;

public partial class Main
{
    private async Task SmokeTest(string directory)
    {
        try
        {
            Directory.CreateDirectory(directory);
            async Task Settle(){for(int i=0;i<6;i++)await ToSignal(GetTree(),SceneTree.SignalName.ProcessFrame);}
            async Task Shot(string name){await Settle();await ToSignal(RenderingServer.Singleton,RenderingServer.SignalName.FramePostDraw);using var image=GetViewport().GetTexture().GetImage();if(image.IsEmpty())throw new Exception("Empty viewport capture");if(image.SavePng(Path.Combine(directory,name+".png"))!=Error.Ok)throw new IOException("Screenshot failed");}
            void Assert(bool ok,string message){if(!ok)throw new Exception(message);}
            await Shot("01-heroes");Assert(overlayKind=="intro","Intro view");
            edit.Hero="hunter";edit.Sandbox=edit.Stress=false;StartNew();game.Status=RunStatus.Paused;
            for(int i=0;i<35;i++)game.Spawn(i%4==0?"pumpkin":"skeleton",game.Player.Pos+World.Direction(i*.73f)*(160+i*9));
            game.RebuildGrid();game.Cast(game.SelectedWeapon);RefreshHud(true);await Shot("02-arena");
            game.Status=RunStatus.Running;game.GainXp(10);game.CheckLevel();game.Status=RunStatus.Upgrading;ShowChoices(false);await Settle();
            Assert(!confirmChoice!.Visible||confirmChoice.Disabled,"No accidental default selection");
            SelectChoice(0);Assert(!confirmChoice.Disabled&&game.OfferSelection==0,"Explicit selection");
            _Input(new InputEventKey{Keycode=Key.Space,Pressed=true});Assert(game.Status==RunStatus.Upgrading,"Space does not confirm");
            await Shot("03-upgrades");Assert(confirmChoice.GetGlobalRect().End.Y<=root.Size.Y+1,"Choice actions fit viewport");
            game.Choose(0);CloseOverlay();game.Status=RunStatus.Running;ShowPause();await Shot("04-pause");
            MakeReady();ShowShop();await Shot("05-legacy");
            edit.Sandbox=true;MakeReady();OpenSandbox();await Shot("06-sandbox-settings");
            edit.Hero="hunter";edit.Enemy="lichLord";edit.Weapon="lightning";edit.Rank=4;edit.Invulnerable=false;StartNew();game.Status=RunStatus.Paused;game.Manual=true;game.Player.Hp=game.Player.MaxHp=1000;
            var boss=game.Enemies.First(e=>e.Def.Boss);boss.SkillClock=0;game.Status=RunStatus.Running;for(int i=0;i<240&&game.Status==RunStatus.Running;i++)game.Tick(1/60f);game.Status=RunStatus.Paused;game.Cast("lightning");renderer.HighlightedWeapon="lightning";RefreshHud(true);await Shot("07-boss-ring");Assert(game.Combat.Hurt>0,"Sandbox boss deals damage");
            ShowBestiary();await Shot("08-bestiary");ShowRecipes();await Shot("09-necronomicon");ShowMap();await Shot("10-map");
            edit.Sandbox=false;edit.Weapon="starter";MakeReady();game.Start();game.Status=RunStatus.Upgrading;game.Offers=["gauntlets","flamethrower","area"];DisplayServer.WindowSetSize(new(960,640));ShowChoices(false);SelectChoice(0);await Shot("11-small-window");Assert(confirmChoice!.GetGlobalRect().End.Y<=root.Size.Y+1,"Small-window actions fit");
            var matrix=new List<object>();
            foreach(var resolution in new[]{new Vector2I(960,640),new Vector2I(1024,768),new Vector2I(1280,720),new Vector2I(1920,1080),new Vector2I(2560,1080),new Vector2I(2560,1440),new Vector2I(3440,1440)})
            {
                DisplayServer.WindowSetSize(resolution);await Settle();
                string tag=$"{resolution.X}x{resolution.Y}";
                CloseOverlay();game.Status=RunStatus.Paused;await Shot("arena-"+tag);
                var viewport=GetViewport().GetVisibleRect().Size;var window=GetWindow().Size;
                Assert(Math.Abs(viewport.X/viewport.Y-window.X/(float)window.Y)<.002f,tag+" viewport matches window aspect, no letterbox");
                Assert(Math.Abs(root.Size.X-viewport.X)<2&&Math.Abs(root.Size.Y-viewport.Y)<2,tag+" HUD covers viewport");
                Assert(renderer.Field.Position.X==0&&Math.Abs(renderer.Field.End.X-viewport.X)<2,tag+" arena fills full width");
                game.Status=RunStatus.Upgrading;game.OfferSelection=-1;ShowChoices(false);await Settle();
                Assert(confirmChoice!.Disabled,tag+" choice requires selection");
                choiceButtons[1].EmitSignal(Godot.Button.SignalName.Pressed);await Shot("upgrades-"+tag);
                Assert(game.OfferSelection==1&&!confirmChoice.Disabled,tag+" card content click selects");
                var frame=overlay.GetGlobalRect();var panel=choiceBody!.GetGlobalRect();
                Assert(frame.Encloses(panel),tag+" entire choice panel fits");
                Assert(choiceButtons.All(b=>b.GetGlobalRect().Position.Y>=choiceScroll!.GetGlobalRect().Position.Y-1),tag+" card tops visible");
                float gap=confirmChoice.GetGlobalRect().Position.Y-choiceScroll!.GetGlobalRect().End.Y;
                Assert(gap>=0&&gap<130,tag+" actions immediately below cards");
                foreach(var b in choiceButtons)
                {
                    var labels=b.FindChildren("*","Label",true,false).Cast<Label>().ToArray();
                    Assert(labels.Length>=5&&labels.Min(l=>l.GlobalPosition.Y)-b.GlobalPosition.Y<30,tag+" top-aligned card content");
                    Assert(labels.All(l=>b.GetGlobalRect().Grow(1).Encloses(l.GetGlobalRect())),tag+" card labels stay inside card");
                }
                matrix.Add(new{requested=tag,actual=$"{window.X}x{window.Y}",viewport=$"{viewport.X:0}x{viewport.Y:0}",actionsGap=gap});
            }
            game.Status=RunStatus.Reward;game.Rewards=[new(){Kind="upgrade",Id="gauntlets",Rank=1},new(){Kind="gold",Value=50},new(){Kind="xp",Value=75}];ShowChoices(true);await Shot("reward-choices");
            SelectChoice(1);confirmChoice!.EmitSignal(Godot.Button.SignalName.Pressed);Assert(game.Rewards.Count==0&&game.Status==RunStatus.Running,"One chest reward confirmed");
            DisplayServer.WindowSetMode(DisplayServer.WindowMode.ExclusiveFullscreen);await Settle();
            game.Status=RunStatus.Paused;await Shot("fullscreen-arena");
            var full=GetViewport().GetVisibleRect().Size;var screen=DisplayServer.ScreenGetSize(DisplayServer.WindowGetCurrentScreen());
            Assert(Math.Abs(full.X/full.Y-screen.X/(float)screen.Y)<.002f,"Fullscreen fills physical screen aspect");
            game.Status=RunStatus.Upgrading;ShowChoices(false);await Shot("fullscreen-upgrades");
            Assert(overlay.GetGlobalRect().Encloses(choiceBody!.GetGlobalRect()),"Fullscreen choice panel fits");
            DisplayServer.WindowSetMode(DisplayServer.WindowMode.Windowed);
            File.WriteAllText(Path.Combine(directory,"resolutions.json"),System.Text.Json.JsonSerializer.Serialize(matrix,new System.Text.Json.JsonSerializerOptions{WriteIndented=true}));
            GD.Print("PASS: native UI smoke test, 7 window sizes + fullscreen, full-width arena, compact readable cards, explicit choices, boss damage. Screenshots at "+directory);GetTree().Quit();
        }
        catch(Exception e){GD.PushError("UI SMOKE FAILED: "+e);GetTree().Quit(1);}
    }
}
