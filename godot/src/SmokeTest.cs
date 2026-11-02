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
            GD.Print("PASS: native UI smoke test, cards/Space guard, boss damage, 11 viewport screenshots at "+directory);GetTree().Quit();
        }
        catch(Exception e){GD.PushError("UI SMOKE FAILED: "+e);GetTree().Quit(1);}
    }
}
