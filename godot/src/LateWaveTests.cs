namespace AsciiSurvivors;

public static partial class PortTests
{
    private static void CheckLateWaves(Catalog c)
    {
        string[] fodder=["grave_rat","grave_bat","bat","ghoul","skeleton","coffin_crawler","mold_corpse","screaming_skull","mummy","spider"];
        foreach(string map in c.Stages.Keys)
        for(int minute=10;minute<90;minute++)
        {
            var g=Fixture(c,map:map);g.Elapsed=minute*60+20;var plan=g.GetWave();
            Check(plan.Entries.All(e=>!fodder.Contains(e.Id)),map+" late waves retire starter fodder at "+minute);
            Check(plan.Entries.Any(e=>!e.Ranged&&!e.Charger&&!e.Special&&!e.Elite),map+" late wave can refill ordinary heavy population");
            Check(plan.Entries.Any(e=>e.Ranged)&&plan.Entries.Any(e=>e.Charger),map+" late threats retain ranged and charging support");
            if(map=="graveyard")Check(plan.Entries.Where(e=>!e.Ranged&&!e.Charger).All(e=>c.Enemies[e.Id].Roster&&c.Enemies[e.Id].At>=Math.Min(1440,g.Time-300)),"Graveyard advances enemy generations");
            if(map=="forest"&&minute<30)Check(plan.Entries.All(e=>c.Enemies[e.Id].At<=g.Time),"Late scripted waves cannot spawn future enemies");
            if(minute>=25)Check(plan.Entries.Where(e=>c.Enemies[e.Id].Hp>=400).Sum(e=>e.Weight)>plan.Entries.Sum(e=>e.Weight)*.5f,map+" endgame is mostly strong enemies");
        }
        var quotas=Fixture(c,map:"forest");quotas.Elapsed=29*60+20;
        for(int i=0;i<100;i++)quotas.SpawnWave();var p=quotas.GetWave();
        Check(quotas.Enemies.Count==p.Target,"Late wave refills without fallback to weak enemies");
        Check(quotas.Enemies.Count(e=>e.Def.Ai=="ranged")<=p.RangedCap&&quotas.Enemies.Count(e=>e.Def.Ai=="charge")<=p.ChargeCap&&quotas.Enemies.Count(e=>e.Def.Rank=="elite")<=p.EliteCap,"Allocation-free selection preserves late quotas");
        Check(quotas.Enemies.All(e=>p.Entries.Any(entry=>entry.Id==e.Kind)),"Late spawned enemies belong to active composition");
        Check(c.ScheduledBosses.SequenceEqual(c.Enemies.Values.Where(e=>e.Roster&&e.Boss).OrderBy(e=>e.At)),"Cached boss schedule preserves ordering");
        foreach(int minute in new[]{25,30,60,90})
        {
            var stress=new Simulation(c,781,new(){Stress=true});stress.Elapsed=minute*60+20;var plan=stress.GetWave();
            Check(plan.Entries.All(e=>!fodder.Contains(e.Id))&&plan.Entries.Where(e=>c.Enemies[e.Id].Hp>=400).Sum(e=>e.Weight)>plan.Entries.Sum(e=>e.Weight)*.5f,"Stress mode also advances to strong late enemies");
        }
    }
}
