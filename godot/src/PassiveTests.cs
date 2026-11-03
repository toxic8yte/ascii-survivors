using System.Numerics;

namespace AsciiSurvivors;

public static partial class PortTests
{
    private static Simulation PassiveScene(Catalog c,string weapon,bool manual=true,bool evolved=false,string passive="",int rank=0)
    {
        var g=Fixture(c);foreach(string id in g.Levels.Keys)g.Levels[id]=0;
        g.Levels[weapon]=2;g.WeaponOrder=[weapon];g.PassiveOrder=[];g.SelectedWeapon=weapon;g.Manual=manual;g.Elapsed=.1;
        if(evolved)g.Evolutions.Add(c.Recipes.Single(r=>r.Weapon==weapon).Id);
        if(passive.Length>0)g.Levels[passive]=rank;
        g.Aim=g.Player.Pos+new Vector2(300,0);g.AimActive=true;g.Player.Invulnerable=100;
        for(int i=0;i<24;i++){var e=g.Spawn("brute",g.Player.Pos+World.Direction(i*MathF.Tau/24)*130);e.Hp=e.MaxHp=1000000;e.Speed=0;}
        var close=g.Spawn("brute",g.Player.Pos+new Vector2(40,0));close.Hp=close.MaxHp=1000000;close.Speed=0;
        foreach(string id in g.Clocks.Keys)g.Clocks[id]=10000;
        g.RebuildGrid();return g;
    }
    private static int AttackUnits(Simulation g,string id)
    {
        if(id=="blades"&&!g.Manual)return g.BladePositions().Count();
        if(id=="bible")return g.BiblePositions().Count();
        if(id=="lightning")return g.Visuals.Count(v=>v.Weapon==id&&v.Shape=="arc");
        return g.Shots.Count+g.Pools.Count+g.Blasts.Count+g.Visuals.Count;
    }
    private static void CheckPassives(Catalog c)
    {
        string[] noAmount=["pulse","poison","frost","lightStaff","laurel","clock","garlic","pentagram"];
        string[] timed=["needle","axe","rune","dagger","fireball","pistol","sling","crossbow","gauss","plasmaMinigun","chozo","flamethrower","electropistol","poison","water","laurel","bible","frost","clock","lightStaff"];
        foreach(var item in c.Items.Where(u=>u.Weapon))foreach(bool evolved in c.Recipes.Any(r=>r.Weapon==item.Id)?new[]{false,true}:new[]{false})foreach(bool manual in new[]{false,true})
        {
            string id=item.Id,label=id+(evolved?" evolved":" base")+(manual?" manual":" auto");
            var basic=PassiveScene(c,id,manual,evolved);basic.Cast(id);int units=AttackUnits(basic,id);
            for(int rank=1;rank<=3;rank++)
            {
                var more=PassiveScene(c,id,manual,evolved,"fork",rank);more.Cast(id);
                bool compatible=!noAmount.Contains(id)&&!(id=="boomerang"&&evolved);
                Check(AttackUnits(more,id)==units+(compatible?rank:0),label+" Duplicator rank "+rank+" emits real attack units");
            }
            var faster=PassiveScene(c,id,manual,evolved,"haste",5);
            Check(faster.Cooldown(id)<basic.Cooldown(id),label+" Haste lowers attack interval");
            foreach(string passive in new[]{"area","silverRing"})
            {
                if(id is "lightning" or "laurel")continue;
                var larger=PassiveScene(c,id,manual,evolved,passive,5);larger.Cast(id);
                float Extent(Simulation g)=>g.Shots.Select(s=>s.Radius).Concat(g.Pools.Select(p=>p.Radius)).Concat(g.Blasts.Select(b=>b.Radius)).Concat(g.Visuals.Select(v=>Math.Max(v.Radius,v.Points.Select(p=>Vector2.Distance(p,g.Player.Pos)).DefaultIfEmpty().Max()))).Concat(g.BladePositions().Select(p=>Vector2.Distance(p,g.Player.Pos))).Concat(g.BiblePositions().Select(p=>Vector2.Distance(p,g.Player.Pos))).DefaultIfEmpty().Max();
                Check(Extent(larger)>Extent(basic),label+" "+passive+" increases attack reach or hitbox");
            }
            if(timed.Contains(id)||id=="pulse"&&evolved)
            {
                var longer=PassiveScene(c,id,manual,evolved,"duration",5);longer.Cast(id);
                float Lifetime(Simulation g)=>g.Shots.Select(s=>s.Life).Concat(g.Pools.Select(p=>p.Life)).Concat(g.Enemies.SelectMany(e=>new[]{e.HolyUntil,e.FrozenUntil,e.ChilledUntil})).Append(g.BibleUntil).Append(g.ShieldUntil).DefaultIfEmpty().Max();
                Check(Lifetime(longer)>Lifetime(basic),label+" Duration extends actual projectile, pool or status lifetime");
            }
            if(basic.Shots.Count>0||id is "blades" or "bible")
            {
                var quicker=PassiveScene(c,id,manual,evolved,"velocity",5);quicker.Cast(id);
                if(id=="axe"&&!evolved)
                {
                    var a=PassiveScene(c,id,manual);var b=PassiveScene(c,id,manual,false,"velocity",5);
                    foreach(var g in new[]{a,b}){g.Enemies.Clear();g.Spawn("brute",g.Player.Pos+new Vector2(300,0));g.RebuildGrid();g.Cast(id);}
                    Check(b.Shots[0].Velocity.Length()>a.Shots[0].Velocity.Length(),label+" faster ballistic flight beyond minimum flight time");
                }
                else if(basic.Shots.Count>0)Check(quicker.Shots[0].Velocity.Length()>basic.Shots[0].Velocity.Length(),label+" projectile velocity grows");
                else if(id=="bible"||!manual)Check((id=="bible"?quicker.BiblePositions():quicker.BladePositions()).First()!=(id=="bible"?basic.BiblePositions():basic.BladePositions()).First(),label+" orbit speed grows");
                if(basic.Shots.Count>0&&basic.Shots[0].Remaining<100000)
                {var piercing=PassiveScene(c,id,manual,evolved,"pierce",1);piercing.Cast(id);Check(piercing.Shots[0].Remaining==basic.Shots[0].Remaining+1,label+" finite projectile gains a penetration");}
            }
            if(id is not ("clock" or "laurel"))
            {
                var stronger=PassiveScene(c,id,manual,evolved,"power",5);stronger.Cast(id);
                foreach(var g in new[]{basic,stronger})foreach(var pool in g.Pools){var e=g.Spawn("brute",pool.Pos);e.Hp=e.MaxHp=1000000;e.Speed=0;}
                foreach(var g in new[]{basic,stronger})foreach(var blast in g.Blasts){var e=g.Spawn("brute",blast.Pos);e.Hp=e.MaxHp=1000000;e.Speed=0;}
                if(id=="bible")foreach(var g in new[]{basic,stronger}){var pos=g.BiblePositions().First();var e=g.Spawn("brute",pos);e.Hp=e.MaxHp=1000000;e.Speed=0;}
                if(id=="blades"&&!manual)foreach(var g in new[]{basic,stronger}){var e=g.Spawn("brute",g.BladePositions().First());e.Hp=e.MaxHp=1000000;e.Speed=0;}
                foreach(var g in new[]{basic,stronger})for(int i=0;i<90;i++)g.Tick(1/60f);
                Check(basic.Combat.Damage>0&&stronger.Combat.Damage>basic.Combat.Damage,label+" Power increases damage through real hit paths");
            }
        }
        foreach(bool manual in new[]{false,true})
        {
            float[] damage=new float[4];
            for(int rank=0;rank<=3;rank++)
            {
                var g=PassiveScene(c,"lightning",manual,false,"fork",rank);g.Enemies.Clear();var e=g.Spawn("brute",g.Player.Pos+new Vector2(100,0));e.Hp=e.MaxHp=1000000;g.RebuildGrid();g.Cast("lightning");damage[rank]=g.Combat.Damage;
                Check(g.Visuals.Count==rank+1&&g.Visuals.Select(v=>string.Join(';',v.Points)).Distinct().Count()==rank+1,"Tesla copies have separate visible paths");
                Close(damage[rank],damage[0]*(rank+1),"Tesla Duplicator damages a single target "+manual+" rank "+rank);
            }
        }
        foreach(string id in new[]{"whip","crowbar","gauntlets"})
        {
            var g=PassiveScene(c,id,true,false,"fork",3);g.Cast(id);
            Check(g.Visuals.Select(v=>(v.Angle,v.Points.LastOrDefault())).Distinct().Count()==g.Visuals.Count,id+" duplicate melee paths remain visible separately");
        }
        var plain=PassiveScene(c,"whip");var fork=PassiveScene(c,"whip",true,false,"fork",1);
        foreach(var g in new[]{plain,fork}){g.Enemies.Clear();var e=g.Spawn("brute",g.Player.Pos+new Vector2(90,-85));e.Radius=8;e.Hp=e.MaxHp=1000000;g.RebuildGrid();g.Cast("whip");}
        Check(plain.Combat.Damage==0&&fork.Combat.Damage>0,"Extra whip lane hits enemies outside the original lanes");
        foreach(string passive in new[]{"power","area"})
        {
            var a=PassiveScene(c,"laurel",true,true);var b=PassiveScene(c,"laurel",true,true,passive,5);
            foreach(var g in new[]{a,b}){g.Enemies.Clear();var e=g.Spawn("brute",g.Player.Pos+new Vector2(passive=="area"?220:80,0));e.Hp=e.MaxHp=1000000;g.RebuildGrid();g.Cast("laurel");g.Player.Invulnerable=0;g.HurtPlayer(20);}
            Check(b.Combat.Damage>a.Combat.Damage,"Evolved shield counterattack benefits from "+passive);
        }
        foreach(string id in new[]{"flamethrower","crossbow"})
        {
            var a=PassiveScene(c,id,true,true);var b=PassiveScene(c,id,true,true,"duration",5);
            foreach(var g in new[]{a,b}){g.Cast(id);for(int i=0;i<12;i++)g.Tick(1/60f);}
            Check(b.Enemies.Max(e=>id=="flamethrower"?e.BurnUntil:e.FrozenUntil)>a.Enemies.Max(e=>id=="flamethrower"?e.BurnUntil:e.FrozenUntil),"Duration extends evolved "+id+" on-hit status");
        }
        CheckUtilityPassives(c);
    }
    private static void CheckUtilityPassives(Catalog c)
    {
        foreach(string weapon in c.Items.Where(u=>u.Weapon).Select(u=>u.Id))
        {
            Simulation Setup(string passive){var g=PassiveScene(c,weapon);g.Enemies.Clear();g.Player.Hp=25;g.Player.Invulnerable=0;if(passive.Length>0)Check(g.ApplyUpgrade(passive),weapon+" accepts "+passive);return g;}
            var normal=Setup("");var movement=Setup("stride");Check(movement.Speed>normal.Speed&&movement.DashCooldown<normal.DashCooldown,weapon+" movement and dash");
            Check(Setup("magnet").Magnet>normal.Magnet,weapon+" pickup range");
            var vital=Setup("vital");Check(vital.Player.MaxHp==normal.Player.MaxHp+25&&vital.Player.Hp==45,weapon+" max HP and immediate heal");
            foreach(string passive in new[]{"regen","leftSign"}){var g=Setup(passive);float before=g.Player.Hp;Tick(g,1);Check(g.Player.Hp>before,weapon+" "+passive+" restores HP");if(passive=="leftSign")Check(g.Player.MaxHp==normal.Player.MaxHp+10,weapon+" left sign max HP");}
            normal.HurtPlayer(20);var armored=Setup("armor");armored.HurtPlayer(20);Check(armored.Combat.Hurt<normal.Combat.Hurt,weapon+" armor reduces actual damage");
            normal.GainXp(100);var growth=Setup("growth");growth.GainXp(100);Check(growth.Combat.Xp>normal.Combat.Xp,weapon+" Growth increases actual XP");
            Check(Setup("luck").Luck>normal.Luck,weapon+" Luck independent of equipped weapon");
            normal.AwardGold(100);foreach(string passive in new[]{"greed","capital","curse","goldRing","rightSign"}){var g=Setup(passive);g.AwardGold(100);Check(g.GoldEarned+g.GoldCarry>normal.GoldEarned+normal.GoldCarry,weapon+" "+passive+" gold");if(passive is "curse" or "goldRing" or "rightSign")Check(g.PressureTime>normal.PressureTime,weapon+" "+passive+" wave pressure");}
            var revived=Setup("revive");revived.HurtPlayer(100000);Check(revived.Status==RunStatus.Running&&revived.RevivesUsed==1&&revived.Player.Hp==MathF.Ceiling(revived.Player.MaxHp/2),weapon+" revive survives fatal damage");
        }
    }
}
