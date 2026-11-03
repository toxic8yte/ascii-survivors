using System.Text.Json;

namespace AsciiSurvivors;

public static partial class PortTests
{
    private static void CheckExactLegacy(Catalog c)
    {
        Check(c.Permanents.Count==27,"Exact table has 27 powerups");
        var g=new Simulation(c,41,new(){Hero="witch",Meta=new(){["vital"]=3,["haste"]=2,["stride"]=2,["magnet"]=2}});
        Close(g.Player.MaxHp,g.Hero.Hp*1.3f,"Legacy HP is percentage");Close(g.Haste,1/.95f,"Cooldown reduction is exactly five percent");Close(g.Speed,g.Hero.Speed*1.1f,"Legacy move speed ten percent");Close(g.Magnet,g.Hero.Magnet*1.5f,"Legacy pickup radius fifty percent");
        int Total(IEnumerable<ShopDef> order){int total=0,n=0;foreach(var item in order)for(int rank=0;rank<item.Max;rank++){total+=SaveStore.RankPrice(item.Cost,rank,n++);}return total;}
        Check(Total(c.Permanents)==27148513&&Total(c.Permanents.AsEnumerable().Reverse())==27148513,"Full table price is order independent and follows formula");
        Check(SaveStore.RankPrice(200,0,0)==200&&SaveStore.RankPrice(200,1,1)==422&&SaveStore.RankPrice(600,0,2)==624,"Initial and globally inflated prices");
        string dir=Path.Combine(Path.GetTempPath(),"ascii-exact-legacy",Guid.NewGuid().ToString("N"));Directory.CreateDirectory(dir);string file=Path.Combine(dir,"state.json");var store=new SaveStore(c,file);store.Profile.Gold=1000000;
        Check(store.Purchase("power","permanent")&&store.Profile.Gold==999800&&store.Profile.LegacySpent==200&&store.PermanentCost("armor")==622,"Purchase records actual spend and updates every price");
        Check(store.Purchase("sealAll","permanent")&&store.SealCapacity==4&&store.SetSeal("pickup:heal",true)&&store.SetSeal("pickup:gold",true),"Seal All gives four places including light pickups");
        int paid=store.Profile.LegacySpent;store.Profile.Heroes.Add("witch");store.Profile.Features.Add("bestiary");
        Check(store.ResetPowerUps()&&store.Profile.Gold==1000000&&paid>10000&&store.Profile.LegacySpent==0&&store.Profile.Ranks.Values.All(r=>r==0)&&store.Profile.SealedItems.Count==0,"Reset refunds actual spend and clears powerups/seals");
        Check(store.Profile.Heroes.Contains("witch")&&store.Profile.Features.Contains("bestiary")&&store.PermanentCost("power")==200,"Reset keeps heroes/collections and restores base prices");
        Check(store.ResetPowerUps()&&store.Profile.Gold==1000000,"Repeated reset cannot mint gold");
        var old=new SaveDocument{Profile=new(){Gold=500,Ranks=new(){["haste"]=5,["armor"]=5,["revive"]=2}}};File.WriteAllText(file,JsonSerializer.Serialize(old,SaveStore.JsonOptions));
        var migrated=new SaveStore(c,file);int oldTotal=35*55+30*55+150*5,kept=35*5+30*14+150;
        Check(migrated.Profile.Ranks["haste"]==2&&migrated.Profile.Ranks["armor"]==3&&migrated.Profile.Ranks["revive"]==1&&migrated.Profile.Gold==500+oldTotal-kept&&migrated.Profile.LegacySpent==kept,"Migration refunds excess ranks at old actual prices");
        Check(migrated.Write()&&new SaveStore(c,file).Profile.Gold==migrated.Profile.Gold,"Migration never refunds twice");
        Check(migrated.ResetPowerUps()&&migrated.Profile.Gold==500+oldTotal,"Reset migrated purchases never uses new expensive prices");
        string overflow=Path.Combine(dir,"overflow.json");File.WriteAllText(overflow,JsonSerializer.Serialize(new SaveDocument{Profile=new(){Gold=int.MaxValue,Ranks=new(){["haste"]=5}}},SaveStore.JsonOptions));
        Check(!migrated.ImportBrowserProfile(overflow)&&migrated.Profile.Gold==500+oldTotal,"Overflowing imported refund is rejected without losing profile");
        var sample=Fixture(c);sample.Meta["preserve"]=5;sample.Meta["reroll"]=1;int rerolls=0,skips=0,banishes=0;
        for(int i=0;i<1000;i++)
        {
            sample.Status=RunStatus.Upgrading;sample.FreeRerollsUsed=0;sample.RerollsUsed=sample.PreservedRerolls=0;sample.DrawOffers();Check(sample.Reroll(),"Preserve reroll succeeds");if(sample.FreeRerollsUsed==0)rerolls++;
            sample.Status=RunStatus.Upgrading;sample.SkipsLeft=1;sample.Xp=0;sample.XpCarry=0;sample.SkipUpgrade();if(sample.SkipsLeft==1)skips++;
            sample.Status=RunStatus.Upgrading;sample.Banished.Clear();sample.BanishesLeft=1;sample.DrawOffers();sample.Banish(0);if(sample.BanishesLeft==1)banishes++;
        }
        Check(rerolls is >430 and <570&&skips is >430 and <570&&banishes is >430 and <570,"Preserve independently saves about half of each resource");
        sample.Status=RunStatus.Upgrading;sample.FreeRerollsUsed=2;sample.PreservedRerolls=0;sample.RerollsUsed=2;sample.GoldEarned=20;sample.RerollGoldSpent=0;sample.DrawOffers();Check(sample.Reroll()&&sample.GoldAvailable==15,"Preserve never cancels paid reroll cost");
        string blocked=Path.Combine(dir,"blocked");File.WriteAllText(blocked,"file");var failing=new SaveStore(c,Path.Combine(blocked,"state.json"));failing.Profile.Gold=2000;Check(!failing.Purchase("power","permanent")&&failing.Profile.Gold==2000&&failing.Profile.LegacySpent==0,"Failed purchase restores wallet and receipt");
        failing.Profile.Ranks["power"]=1;failing.Profile.LegacySpent=200;Check(!failing.ResetPowerUps()&&failing.Profile.Gold==2000&&failing.Profile.Ranks["power"]==1&&failing.Profile.LegacySpent==200,"Failed reset restores complete transaction");
        var fire=Fixture(c);fire.DisabledItems=["pickup:heal","pickup:gold"];foreach(var f in fire.MapWorld.Campfires)fire.BreakCampfire(f);Check(fire.Hearts.Count==0&&fire.Gems.Count==0,"Light pickup seals prevent the selected drops");
    }
}
