using System.Numerics;
using System.Text.Json;

namespace AsciiSurvivors;

public static partial class PortTests
{
    private static void CheckLegacyExpansion(Catalog c)
    {
        Check(c.Permanents.Count==27&&c.Permanents.Select(p=>p.Id).Distinct().Count()==27,"All 27 Legacy lines unique");
        var g=Fixture(c);var baseline=Fixture(c);foreach(var item in c.Permanents)g.Meta[item.Id]=item.Max;
        Check(g.Power>baseline.Power&&g.Area>baseline.Area&&g.Duration>baseline.Duration&&g.ProjectileSpeed>baseline.ProjectileSpeed&&g.Greed>baseline.Greed,"Permanent combat and economy stats affect simulation");
        var a=baseline.GetWave();var b=g.GetWave();Check(b.Target>a.Target&&b.Interval<a.Interval,"Curse and Charm change waves");
        var normal=baseline.Spawn("brute");var cursed=g.Spawn("brute");Check(cursed.Hp>normal.Hp&&cursed.Speed>normal.Speed,"Curse buffs real enemy health and speed");
        g.Player.Hp=20;Tick(g,1);Check(g.Player.Hp>20.45f,"Permanent Recovery heals");
        int harmless=0;for(int i=0;i<500;i++){var e=g.Spawn("pumpkin");if(e.Pacified){harmless++;Check(e.Damage==0,"Defanged enemy has no contact damage");}}
        Check(harmless is >45 and <110&&!g.Spawn("lichLord").Pacified,"Defang probability and boss exclusion");
        string[] noAmount=["pulse","poison","frost","lightStaff","laurel","clock","garlic","pentagram"];
        foreach(var item in c.Items.Where(i=>i.Weapon))
        {
            var basic=PassiveScene(c,item.Id);basic.Cast(item.Id);var amount=PassiveScene(c,item.Id);amount.Meta["amount"]=1;amount.Cast(item.Id);
            Check(AttackUnits(amount,item.Id)==AttackUnits(basic,item.Id)+(noAmount.Contains(item.Id)?0:1),item.Id+" permanent Amount adds real unit");
        }
        var reroll=Fixture(c);reroll.Meta["reroll"]=1;reroll.GainXp(6);
        Check(reroll.RerollCost==0&&reroll.Reroll()&&reroll.FreeRerollsLeft==1&&reroll.GoldEarned==0,"First free reroll");
        Check(reroll.Reroll()&&reroll.FreeRerollsLeft==0&&reroll.RerollCost==5&&!reroll.Reroll(),"Free rerolls do not inflate next paid cost");
        reroll.GoldEarned=10;Check(reroll.Reroll()&&reroll.GoldAvailable==5&&reroll.RerollCost==10,"Paid escalation resumes at five");
        reroll.SkipsLeft=1;Check(reroll.SkipUpgrade()&&reroll.SkipsLeft==0&&reroll.Status==RunStatus.Running&&reroll.Xp>0,"Skip consumes charge and grants XP");
        var fireGame=Fixture(c);fireGame.Manual=false;fireGame.Levels["garlic"]=1;var fire=fireGame.MapWorld.Campfires.First();fireGame.Player.Pos=fire.Pos+new Vector2(40,0);fireGame.Player.Prev=fireGame.Player.Pos;fireGame.Player.Hp=50;Tick(fireGame,1.2f);
        Check(fireGame.CampfiresBroken.Contains(fire.Id)&&fireGame.MapWorld.Cells[fire.Id] is null&&!fireGame.BreakCampfire(fire),"Rank one weapon breaks campfire once and removes collision");
        var autoFire=Fixture(c);autoFire.Manual=false;Tick(autoFire,3);Check(autoFire.CampfiresBroken.Contains(14*World.Cols+16),"Auto aim targets nearby campfire when no enemies remain");
        string json=JsonSerializer.Serialize(fireGame,SaveStore.JsonOptions);var restored=JsonSerializer.Deserialize<Simulation>(json,SaveStore.JsonOptions)!;restored.RepairAfterLoad(c);
        Check(restored.CampfiresBroken.Contains(fire.Id)&&restored.MapWorld.Cells[fire.Id] is null&&!restored.BreakCampfire(restored.MapWorld.Campfires.First(f=>f.Id==fire.Id)),"Broken fire persists and cannot duplicate loot");
        var drops=Fixture(c);foreach(var f in drops.MapWorld.Campfires)Check(drops.BreakCampfire(f),"Generated campfire drops loot");Check(drops.Hearts.Count>10&&drops.Gems.Count(g=>g.Gold)>10&&drops.Gems.All(g=>g.Gold),"Campfires drop healing and coins, never XP");
        string dir=Path.Combine(Path.GetTempPath(),"ascii-legacy",Guid.NewGuid().ToString("N"));var store=new SaveStore(c,Path.Combine(dir,"state.json"));store.Profile.Gold=10000000;
        Check(!store.SetSeal("pentagram",true)&&store.Purchase("seal1","permanent")&&store.SealCapacity==1&&store.SetSeal("pentagram",true)&&!store.SetSeal("water",true),"Seals require bought capacity");
        Check(new SaveStore(c,Path.Combine(dir,"state.json")).Profile.SealedItems.Contains("pentagram"),"Seal survives restart");Check(store.SetSeal("pentagram",false)&&store.SetSeal("water",true),"Unsealing restores capacity");
        foreach(var item in c.Permanents.Where(i=>i.Id!="seal1"))Check(store.Purchase(item.Id,"permanent"),item.Id+" can be bought with gold");
        var fresh=new Simulation(c,56,new(){Meta=new(store.Profile.Ranks)});Check(fresh.SkipsLeft==2&&fresh.BanishesLeft==2&&fresh.FreeRerollsLeft==2&&fresh.Amount==1,"Purchased choice and Amount bonuses active from new run");
    }
}
