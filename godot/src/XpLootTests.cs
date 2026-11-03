using System.Numerics;
using System.Text.Json;

namespace AsciiSurvivors;

public static partial class PortTests
{
    private static void CheckXpAndLoot(Catalog c)
    {
        var boosted=Fixture(c);boosted.GainCrystalXp(100);Check(boosted.Combat.Xp==115,"Crystals grant fifteen percent more experience");
        var rings=Fixture(c);Close(rings.BossHealth(1),1050,"Ring boss one thirty percent less HP");Close(rings.BossHealth(2),2240,"Ring boss two thirty percent less HP");
        Close(c.Enemies["lichLord"].Hp,1540,"Ordinary Lich base HP reduced");Close(c.Enemies["darVetro"].Hp,11340,"Mega boss base HP reduced");
        var migratedBoss=Fixture(c);var oldBoss=migratedBoss.Spawn("lichLord");oldBoss.Hp=1000;oldBoss.MaxHp=2000;migratedBoss.BossHealthVersion=0;
        var bossJson=JsonSerializer.Serialize(migratedBoss,SaveStore.JsonOptions);var restoredBoss=JsonSerializer.Deserialize<Simulation>(bossJson,SaveStore.JsonOptions)!;restoredBoss.RepairAfterLoad(c);
        Close(restoredBoss.Enemies[0].Hp,700,"Existing boss current HP reduced");Close(restoredBoss.Enemies[0].MaxHp,1400,"Existing boss max HP reduced");restoredBoss.RepairAfterLoad(c);Close(restoredBoss.Enemies[0].MaxHp,1400,"Boss balance migration runs only once");
        var g=Fixture(c,"duelist");g.Level=5;g.Xp=23;g.XpNeed=33;g.XpCarry=.7417251f;g.AddGem(g.Player.Pos,15);
        g.AddGem(g.Player.Pos+new Vector2(200,0),8,true);g.Hearts.Add(new(){Pos=g.Player.Pos+new Vector2(200,0)});
        g.AddGem(g.Player.Pos+new Vector2(300,0),7,true,"campfire");g.Hearts.Add(new(){Pos=g.Player.Pos+new Vector2(300,0),Source="campfire"});
        string json=JsonSerializer.Serialize(g,SaveStore.JsonOptions);var loaded=JsonSerializer.Deserialize<Simulation>(json,SaveStore.JsonOptions)!;loaded.RepairAfterLoad(c);
        Check(loaded.Level==5&&loaded.Xp==23&&loaded.Gems.Where(g=>!g.Gold).Sum(g=>g.Value)==15,"Resume preserves every uncollected XP gem");
        Check(loaded.Gems.Count(g=>g.Gold)==1&&loaded.Gems.Single(g=>g.Gold).Source=="campfire"&&loaded.Hearts.Count==1,"Resume removes legacy monster loot but keeps tagged campfire loot");
        loaded.Status=RunStatus.Running;loaded.Tick(1/60f);Check(loaded.Level==6&&loaded.Status==RunStatus.Upgrading&&loaded.Offers.Count==3,"Reported 23/33 plus remaining gems reaches level six after resume");
        Check(loaded.Choose(0),"Level six choice resumes run");
        while(loaded.Level<15)
        {
            int before=loaded.Level;loaded.AddGem(loaded.Player.Pos,MathF.Ceiling((loaded.XpNeed-loaded.Xp)/loaded.Growth/loaded.XpEfficiency)+1);loaded.Tick(1/60f);
            Check(loaded.Level==before+1&&loaded.Status==RunStatus.Upgrading,"Crystal pickup advances level "+loaded.Level);
            Check(loaded.Choose(0),"Confirmed level "+loaded.Level);
        }
        var enemies=Fixture(c);enemies.Meta["luck"]=3;enemies.Levels["luck"]=5;
        for(int i=0;i<1000;i++){var e=enemies.Spawn(i%7==0?"pumpkin":"skeleton",enemies.Player.Pos+new Vector2(300,0));enemies.HurtEnemy(e,1e9f);}
        Check(enemies.Gems.Count>0&&enemies.Gems.All(g=>!g.Gold)&&enemies.Hearts.Count==0&&enemies.Combat.HeartsDropped==0&&enemies.GoldEarned==0,"1000 ordinary kills give XP only, even with maximum luck");
        var boss=enemies.Spawn("lichLord");enemies.HurtEnemy(boss,1e9f);Check(enemies.Chests.Count==1&&enemies.Gems.All(g=>!g.Gold)&&enemies.Hearts.Count==0,"Boss retains chest without ground coins or medicine");
        var fires=Fixture(c);foreach(var fire in fires.MapWorld.Campfires)fires.BreakCampfire(fire);
        Check(fires.Gems.Any(g=>g.Gold)&&fires.Hearts.Count>0&&fires.Gems.All(g=>g.Gold&&g.Source=="campfire")&&fires.Hearts.All(h=>h.Source=="campfire"),"Only broken campfires create tagged gold and healing drops");
    }
}
