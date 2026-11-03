using System.Numerics;
using System.Text.Json;

namespace AsciiSurvivors;

public static partial class PortTests
{
    private static int checks;
    private static void Check(bool condition,string message){checks++;if(!condition)throw new InvalidOperationException(message);}
    private static void Close(float actual,float expected,string label,float tolerance=.15f)=>Check(MathF.Abs(actual-expected)<=tolerance,$"{label}: got {actual}, expected {expected}");
    private static void Tick(Simulation g,float seconds){for(int i=0;i<(int)MathF.Ceiling(seconds*60);i++)g.Tick(1/60f);}
    private static Simulation Fixture(Catalog c,string hero="hunter",string map="forest")
    {var g=new Simulation(c,727,new(){Hero=hero,Map=map,Manual=true});g.Start();g.Enemies=[];g.NextBossAt=g.SpawnClock=g.NextMegaAt=1e8f;return g;}
    public static void Run(Catalog c,string referenceJson)
    {
        Check(c.Heroes.Count==30&&c.Items.Count(x=>x.Weapon)==33&&c.Items.Count(x=>!x.Weapon)==22&&c.Enemies.Count==58&&c.Recipes.Count==31,"Full content roster");
        foreach(var hero in c.Heroes.Values){var g=Fixture(c,hero.Id);Check(g.Inventory(true).SequenceEqual(new[]{hero.Weapon}.Concat(hero.ExtraWeapons)),hero.Id+" starting loadout");Close(g.Player.Hp,hero.Hp,hero.Id+" hp");}
        using var references=JsonDocument.Parse(referenceJson);
        foreach(var sample in references.RootElement.GetProperty("cases").EnumerateArray())
        {
            string id=sample.GetProperty("id").GetString()!;bool evolved=sample.GetProperty("evolved").GetBoolean();string label=id+(evolved?" evolved":" base");
            var g=Fixture(c);foreach(string key in g.Levels.Keys)g.Levels[key]=0;g.Levels[id]=4;g.SelectedWeapon=id;g.WeaponOrder=[id];g.PassiveOrder=[];
            if(evolved){var r=c.Recipes.First(r=>r.Weapon==id);foreach(string secondary in r.Weapons)g.Levels[secondary]=c.ById[secondary].Max;foreach(var p in r.Passives)while(g.L(p.Key)<p.Value)g.ApplyUpgrade(p.Key);Check(g.Evolve(r),label+" evolution");}
            g.Aim=g.Player.Pos+new Vector2(300,0);g.AimActive=true;var enemy=g.Spawn("brute",g.Player.Pos+new Vector2(65,0));enemy.Hp=enemy.MaxHp=1000000;enemy.Speed=0;g.RebuildGrid();g.Cast(id);
            Close(1000000-enemy.Hp,sample.GetProperty("directDamage").GetSingle(),label+" direct damage");
            var shots=sample.GetProperty("shots").EnumerateArray().ToArray();Check(g.Shots.Count==shots.Length,label+" projectile count");
            for(int i=0;i<shots.Length;i++){var expected=shots[i];var actual=g.Shots[i];Close(actual.Velocity.X,expected.GetProperty("vx").GetSingle(),label+" vx",.01f);Close(actual.Velocity.Y,expected.GetProperty("vy").GetSingle(),label+" vy",.01f);Close(actual.Damage,expected.GetProperty("damage").GetSingle(),label+" damage",.01f);Close(actual.Radius,expected.GetProperty("radius").GetSingle(),label+" radius",.01f);Close(actual.ChargeLeft,expected.GetProperty("charge").GetSingle(),label+" charge",.01f);}
            var pools=sample.GetProperty("pools").EnumerateArray().ToArray();Check(pools.Length==g.Pools.Count,label+" pools");for(int i=0;i<pools.Length;i++){Close(g.Pools[i].Radius,pools[i].GetProperty("radius").GetSingle(),label+" pool radius");Close(g.Pools[i].Life,pools[i].GetProperty("life").GetSingle(),label+" pool life");}
            var blasts=sample.GetProperty("blasts").EnumerateArray().ToArray();Check(blasts.Length==g.Blasts.Count,label+" blasts");for(int i=0;i<blasts.Length;i++){Close(g.Blasts[i].Damage,blasts[i].GetProperty("damage").GetSingle(),label+" blast damage");Close(g.Blasts[i].Radius,blasts[i].GetProperty("radius").GetSingle(),label+" blast radius");}
            Close(enemy.FrozenUntil,sample.GetProperty("frozen").GetSingle(),label+" freeze");Close(enemy.ChilledUntil,sample.GetProperty("chilled").GetSingle(),label+" chill");Check(g.ShieldCharges==sample.GetProperty("shields").GetInt32(),label+" shield");Close(g.BibleUntil,sample.GetProperty("bibleUntil").GetSingle(),label+" books");
            if(sample.GetProperty("cooldown").ValueKind!=JsonValueKind.Null)Close(g.Cooldown(id),sample.GetProperty("cooldown").GetSingle(),label+" cooldown",.0001f);
        }
        var rolls=Fixture(c);rolls.GainXp(6);Check(rolls.Status==RunStatus.Upgrading,"Level pauses");Check(rolls.Offers.Count(id=>c.ById[id].Weapon)==2,"Two weapons and one passive");Check(!rolls.Reroll(),"No money from Legacy");rolls.GoldEarned=20;var first=rolls.Offers.ToArray();Check(rolls.Reroll()&&rolls.GoldAvailable==15&&rolls.RerollCost==10,"Run-only escalating reroll");Check(rolls.Offers.All(id=>!first.Contains(id)),"Full replacement");Check(rolls.Choose(0),"Confirm reward");
        foreach(var map in c.Stages.Keys){var g=Fixture(c,map:map);g.Elapsed=140;var plan=g.GetWave();Check(plan.Entries.Any(e=>e.Ranged)&&plan.Entries.Any(e=>e.Charger),map+" early threats");for(int i=0;i<100;i++)g.SpawnWave();Check(g.Enemies.Count==g.GetWave().Target,map+" population cap");}
        foreach(var pair in c.Enemies.Where(x=>x.Value.Boss))
        {var g=new Simulation(c,83,new(){Sandbox=true,Manual=true,Enemy=pair.Key});g.Start();Check(g.Arena?.Phase=="locked",pair.Key+" sandbox ring");g.Player.Hp=g.Player.MaxHp=1000;g.Enemies[0].SkillClock=0;Tick(g,7);Check(g.Combat.Hurt>0,pair.Key+" inflicts damage");var boss=g.Enemies.First(e=>e.Def.Boss);g.HurtEnemy(boss,1e9f);Check(g.Arena is null&&g.GoldEarned==0&&g.Chests.Count==0,pair.Key+" releases without rewards");}
        var circle=Fixture(c);circle.NextBossAt=0;Tick(circle,5.1f);var lich=circle.Enemies.First(e=>e.Def.Boss);Close(lich.MaxHp,1500,"First boss health");Check(circle.Arena?.Phase=="locked","Warning closes");circle.Player.Invulnerable=100;Tick(circle,15.1f);Check(circle.Arena is null&&lich.Alive,"Wall expires while boss lives");circle.HurtEnemy(lich,1e9f);Check(circle.Chests.Count==1,"Boss drops chest");Check(circle.OpenChest(circle.Chests[0]),"Chest opens");Check(circle.Rewards.Count==3&&circle.ClaimReward(0)&&!circle.ClaimReward(0),"One of three rewards only");
        var supply=Fixture(c);supply.Player.Hp=40;var box=supply.MapWorld.Supplies.First(b=>b.Kind=="heal");supply.Player.Pos=box.Pos;Check(supply.OpenSupply(box)&&!supply.OpenSupply(box),"Crate only once");Close(supply.Player.Hp,70,"Crate heal");
        CheckStarterWeapons(c);
        CheckPassives(c);
        CheckSoundEvents(c);
        CheckTelemetry(c);
        CheckCleanup(c);
        var crowd=Benchmarks.Scene(c,512,true,false);foreach(var e in crowd.Enemies)e.Pos=crowd.Player.Pos+new Vector2(80,0);crowd.RebuildGrid();crowd.Tick(1/60f);
        Check(crowd.Enemies.Count==512&&crowd.Timings!.CrowdCandidates is >0 and <=512*32,"Dense crowd candidate work is bounded without dropping enemies");
        Check(crowd.Enemies.Select(e=>e.Pos).Distinct().Count()>1,"Bounded crowd solver separates overlapping bodies");
        crowd.RebuildGrid();Check(crowd.Near(crowd.Player.Pos,500).Select(e=>e.Id).Distinct().Count()==512,"Reused grid preserves every living enemy");
        SaveTests(c);
        Console.WriteLine($"PASS: {checks} native C# checks, 64 JS weapon/evolution references, all heroes/enemies, progression, waves, boss AI, walls and rewards.");
    }
    private static void CheckStarterWeapons(Catalog c)
    {
        var shot=Fixture(c);shot.Manual=false;shot.Clocks["needle"]=1000;shot.Player.Facing=Vector2.UnitX;
        var near=shot.Spawn("brute",shot.Player.Pos-new Vector2(100,0));var far=shot.Spawn("brute",shot.Player.Pos+new Vector2(180,0));
        near.Hp=near.MaxHp=far.Hp=far.MaxHp=1000;near.Speed=far.Speed=0;shot.RebuildGrid();shot.Cast("needle");
        Check(shot.Shots.Count==1&&shot.Shots[0].Velocity.X<0,"Igniter aims at nearest enemy opposite facing");
        Tick(shot,.3f);Close(near.Hp,981,"Igniter projectile actually deals audited damage");Close(far.Hp,1000,"Igniter does not damage enemy behind it");
        var manual=Fixture(c);manual.AimActive=true;manual.Aim=manual.Player.Pos+new Vector2(0,300);manual.Cast("needle");Check(manual.Shots[0].Velocity.Y>0&&Math.Abs(manual.Shots[0].Velocity.X)<.01f,"Manual igniter follows cursor without a target");
        var aura=Fixture(c);aura.Levels["needle"]=0;aura.Levels["garlic"]=2;
        var inside=aura.Spawn("brute",aura.Player.Pos+new Vector2(0,80));var outside=aura.Spawn("brute",aura.Player.Pos+new Vector2(220,0));
        inside.Hp=inside.MaxHp=outside.Hp=outside.MaxHp=1000;inside.Speed=outside.Speed=0;aura.RebuildGrid();aura.Cast("garlic");
        Close(inside.Hp,989.8f,"Censer damages whole aura away from moving ball");Close(outside.Hp,1000,"Censer cannot damage beyond aura");
    }
}
