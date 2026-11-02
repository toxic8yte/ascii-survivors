using System.Text.Json;

namespace AsciiSurvivors;

public static partial class PortTests
{
    private static void SaveTests(Catalog c)
    {
        string dir=Path.Combine(Path.GetTempPath(),"ascii-survivors-tests",Guid.NewGuid().ToString("N"));Directory.CreateDirectory(dir);
        string file=Path.Combine(dir,"state.json");var store=new SaveStore(c,file);var g=Fixture(c);Tick(g,.2f);g.GoldEarned=20;g.Player.Pos=new(6591,4701);g.GainXp(6);
        Check(store.Checkpoint(g)&&store.Profile.Gold==70,"Atomic profile/run checkpoint");Check(store.Checkpoint(g)&&store.Profile.Gold==70,"Checkpoint does not duplicate gold");
        var saved=new SaveStore(c,file);var run=saved.SavedRun!;Check(run is not null&&run.Status==RunStatus.Upgrading&&run.Offers.SequenceEqual(g.Offers),"Pending choices survive restart");Close(run!.Player.Pos.X,6591,"Saved coordinates");Check(run.RandomState==g.RandomState&&run.WeaponOrder.SequenceEqual(g.WeaponOrder),"Inventory and RNG survive restart");
        Check(saved.Reroll(run)&&saved.Profile.Gold==65&&run.GoldAvailable==15,"Reroll charges run and checkpoint once");var reopened=new SaveStore(c,file);Check(reopened.SavedRun?.RerollCost==10&&reopened.Profile.Gold==65,"Reroll fee and price survive restart");
        Check(reopened.Finish(reopened.SavedRun!)&&!reopened.Finish(reopened.SavedRun??run),"Finish is idempotent");Check(reopened.Profile.Gold==65&&reopened.Profile.Runs==1&&reopened.SavedRun is null,"Finish never refunds fees");
        var poor=Fixture(c);Tick(poor,.1f);poor.GainXp(6);Check(!reopened.Reroll(poor),"Legacy gold cannot pay reroll");
        var failure=new SaveStore(c,Path.Combine(dir,"blocked","state.json"));File.WriteAllText(Path.Combine(dir,"blocked"),"not a directory");failure.Profile.Gold=1000;var failing=Fixture(c);Tick(failing,.1f);failing.GoldEarned=20;failing.GainXp(6);var offers=failing.Offers.ToArray();uint rng=failing.RandomState;
        Check(!failure.Reroll(failing)&&failure.Profile.Gold==1000&&failure.SavedRun is null,"Failed write rolls back money and run");Check(failing.RerollsUsed==0&&failing.RerollGoldSpent==0&&failing.RandomState==rng&&failing.Offers.SequenceEqual(offers),"Failed reroll restores choices and RNG");
        string browser=Path.Combine(dir,"browser.json");File.WriteAllText(browser,"""{"profile":{"version":2,"meta":{"gold":321,"lifetimeGold":654,"ranks":{"power":2}},"heroes":{"unlocked":["hunter","brawler"]},"unlocks":["bestiary"],"seen":["lichLord"],"character":"hunter","runs":7,"seconds":120,"best":{"time":80}}}""");
        Check(reopened.ImportBrowserProfile(browser)&&reopened.Profile.Gold==321&&reopened.Profile.Ranks["power"]==2&&reopened.Profile.Features.Contains("bestiary"),"Import browser permanent progress");Check(reopened.Profile.Runs==7&&reopened.Profile.Seen.Contains("lichLord"),"Import statistics and encounters");
        string invalid=Path.Combine(dir,"bad-import.json");File.WriteAllText(invalid,"""{"Version":1,"Profile":{"Gold":-1}}""");Check(!reopened.ImportBrowserProfile(invalid)&&reopened.Profile.Gold==321,"Invalid import keeps profile intact");
        string backup=Path.Combine(dir,"export.json");File.WriteAllText(backup,JsonSerializer.Serialize(saved.Document,SaveStore.JsonOptions));Check(reopened.ImportBrowserProfile(backup)&&reopened.Profile.Gold==65&&reopened.SavedRun?.RerollCost==10,"Native backup restores profile and battle");
        File.WriteAllText(file,"{broken");var recovered=new SaveStore(c,file);Check(recovered.Profile.Gold==321&&recovered.LastError.Contains("резервная"),"Corrupt primary recovers backup");
        string broken=Path.Combine(dir,"all-bad.json");File.WriteAllText(broken,"""{"Version":1,"Profile":null}""");var fresh=new SaveStore(c,broken);Check(fresh.Profile.Gold==50&&Directory.GetFiles(dir,"all-bad.json.corrupt-*").Length==1,"Corrupt profile preserved and reset safely");
        Console.WriteLine("Save tests isolated at "+dir);
    }
}
