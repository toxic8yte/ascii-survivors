using System.Numerics;
using System.Text.Json;

namespace AsciiSurvivors;

public static partial class PortTests
{
    private static void CheckGameplayReview(Catalog c)
    {
        var g=Fixture(c);int weaponCards=0;var counts=c.Items.Where(i=>i.Weapon).ToDictionary(i=>i.Id,_=>0);int[] tiers=new int[5];
        for(int i=0;i<6000;i++)
        {
            g.DrawOffers();Check(g.Offers.Count==3&&g.Offers.Distinct().Count()==3,"Offers unique");
            foreach(string id in g.Offers.Where(id=>c.ById[id].Weapon)){weaponCards++;counts[id]++;tiers[g.OfferTiers[id]]++;}
        }
        Check(weaponCards is >8750 and <9250,"Category sample is 50/50, not fixed 2/1");
        Check(counts.Values.All(n=>n>170)&&counts["pentagram"]>170,"Every weapon including pentacle is reachable without rarity starvation");
        Check(tiers[0]>weaponCards*.62&&tiers[0]<weaponCards*.68&&tiers[4]>15&&tiers[4]<85,"Quality tiers use declared baseline odds");
        var baseWeights=g.TierWeights();g.Levels["luck"]=5;g.Meta["luck"]=5;var lucky=g.TierWeights();
        Check(lucky[4]/lucky.Sum()>baseWeights[4]/baseWeights.Sum()*2,"Passive and Legacy luck improve legendary chance");
        Close(g.DashCooldown,1,"Base dash one second",.0001f);g.Levels["dash"]=4;Check(g.DashCooldown is >.5f and <.61f,"Dedicated dash passive shortens cooldown");g.Levels["stride"]=3;Check(g.DashCooldown>=.5f,"Dash floor");
        g.DisabledItems=["pentagram","power"];for(int i=0;i<100;i++){g.DrawOffers();Check(g.Offers.All(id=>!g.DisabledItems.Contains(id)),"Excluded items absent");}
        g.DisabledItems.Clear();g.Banished=c.Items.Where(i=>!i.Weapon).Select(i=>i.Id).ToHashSet();g.DrawOffers();Check(g.Offers.Count==3&&g.Offers.All(id=>c.ById[id].Weapon),"Category exhaustion falls back to valid offers");
        var quality=PassiveScene(c,"pistol");Check(quality.ApplyUpgrade("pistol",4),"Legendary upgrade applies");Close(quality.WeaponQuality("pistol"),1.5f,"Legendary persistent damage bonus",.001f);
        var enemy=quality.Enemies[0];float hp=enemy.Hp;quality.HurtEnemy(enemy,100,0,"pistol");Close(hp-enemy.Hp,100*c.ById["pistol"].DamageMultiplier*1.5f,"Quality affects actual damage");
        Check(quality.ApplyUpgrade("pistol",0),"Common next rank");Close(quality.WeaponQuality("pistol"),1.5f,"Common upgrade keeps previous quality bonus");
        var beam=PassiveScene(c,"clock",false);beam.Enemies.Clear();beam.Player.Facing=Vector2.UnitX;beam.Levels["clock"]=3;
        var behind=beam.Spawn("brute",beam.Player.Pos-new Vector2(180,0));behind.Hp=behind.MaxHp=10000;beam.RebuildGrid();beam.Cast("clock");
        Check(beam.Visuals.Single().Points[^1].X<beam.Player.Pos.X&&behind.FrozenUntil>beam.Time,"Auto beam targets enemy opposite facing");Check(beam.Cooldown("clock")<1,"Doctor beam casts in less than a second");
        var bossBeam=PassiveScene(c,"clock",true);bossBeam.Enemies.Clear();var boss=bossBeam.Spawn("lichLord",bossBeam.Player.Pos+new Vector2(120,0));bossBeam.Levels["haste"]=5;bossBeam.Meta["haste"]=5;bossBeam.QualityBonus["clock"]=1.5f;bossBeam.RebuildGrid();bossBeam.Cast("clock");Check(boss.FrozenUntil-bossBeam.Time<bossBeam.Cooldown("clock"),"Faster beam cannot freeze bosses permanently");
        foreach(var item in c.Items.Where(i=>i.Weapon&&i.Id!="laurel"))
        {
            var defense=PassiveScene(c,item.Id,false);defense.Levels[item.Id]=3;defense.Cast(item.Id);
            if(defense.Blasts.Count>0)Tick(defense,.7f);
            Vector2 anchor=defense.Player.Pos;
            if(item.Id=="blades")anchor=defense.BladePositions().First();
            else if(item.Id=="bible")anchor=defense.BiblePositions().First();
            else if(defense.Shots.Count>0){var s=defense.Shots[0];s.ChargeLeft=0;anchor=s.Pos;}
            else if(defense.Pools.Count>0)anchor=defense.Pools[0].Pos;
            else if(defense.Visuals.FirstOrDefault(v=>v.Weapon==item.Id) is {} v)anchor=v.Points.Length>1?(v.Points[0]+v.Points[1])/2:v.Shape is "slash" or "crowbar" or "fist"?v.Pos+World.Direction(v.Angle)*v.Radius*.5f:v.Pos;
            var ball=new Projectile{Weapon="pumpkin",Pos=anchor,Prev=anchor,Life=3,Radius=7};
            Check(defense.DeflectPumpkin(ball),item.Id+" rank three attack blocks pumpkin");defense.Levels[item.Id]=2;Check(!defense.DeflectPumpkin(ball),item.Id+" rank two does not block");
            defense.Levels[item.Id]=3;ball.Weapon="lichLord";Check(!defense.DeflectPumpkin(ball),item.Id+" does not erase other enemy attacks");
        }
        var pumpkin=Fixture(c);var shooter=pumpkin.Spawn("pumpkin",pumpkin.Player.Pos+new Vector2(300,0));shooter.Windup=.001f;shooter.SkillClock=100;Tick(pumpkin,1/60f);
        Check(pumpkin.EnemyShots.Count>0&&pumpkin.EnemyShots.All(s=>s.Weapon=="pumpkin"&&s.Life<=3.2f&&s.Life>3.1f),"Pumpkin lifetime reduced exactly 20 percent");
        var coins=Fixture(c);coins.AddGem(coins.Player.Pos,5);coins.AddGem(coins.Player.Pos,10,true);Check(coins.Gems.Count==2,"Gold and XP never merge");coins.Player.Invulnerable=10;Tick(coins,1/60f);Check(coins.GoldEarned==4&&coins.Xp==5&&coins.Gems.Count==0,"Coins grant gold, not XP");
        coins.AddGem(coins.Player.Pos+new Vector2(200,0),1,true,"campfire");coins.Levels["pistol"]=1;coins.QualityBonus["pistol"]=.5f;coins.DisabledItems=["water"];coins.Status=RunStatus.Upgrading;coins.DrawOffers();
        string save=JsonSerializer.Serialize(coins,SaveStore.JsonOptions);var loaded=JsonSerializer.Deserialize<Simulation>(save,SaveStore.JsonOptions)!;loaded.Levels.Remove("dash");loaded.RepairAfterLoad(c);
        Check(loaded.Gems.Single().Gold&&loaded.WeaponQuality("pistol")==1.5f&&loaded.DisabledItems.Contains("water")&&loaded.OfferTiers.SequenceEqual(coins.OfferTiers)&&loaded.Levels.ContainsKey("dash"),"Coins, qualities, exclusions and offers persist; old saves migrate");
        foreach(var h in c.Heroes.Values)Check(h.Sprite.Split('\n').Length==4&&h.FacingSprites.Count==4&&h.FacingSprites.Values.Distinct().Count()==4&&h.Sprite.Split('\n').Select(r=>r.Length).Distinct().Count()==1,h.Id+" aligned distinct four-way portrait");
        foreach(var b in c.Enemies.Values.Where(e=>e.Boss))Check(b.Sprite.Split('\n').Length==7&&b.Sprite.Split('\n').Select(r=>r.Length).Distinct().Count()==1&&b.Frames.Length==0,b.Id+" aligned boss portrait");
        Check(c.Enemies.Values.Where(e=>e.Boss).Select(e=>e.Sprite).Distinct().Count()==13,"All bosses have distinct silhouettes");
        Console.WriteLine("Drop sample: "+weaponCards+" weapon cards / 18000; pentacle "+counts["pentagram"]+"; quality "+string.Join(',',tiers));
    }
}
