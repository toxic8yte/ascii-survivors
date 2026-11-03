using System.Numerics;
using System.Text.Json;

namespace AsciiSurvivors;

public static partial class PortTests
{
    private static void CheckSoundEvents(Catalog c)
    {
        foreach(var weapon in c.Items.Where(u=>u.Weapon))
        {
            Check(Simulation.WeaponSound(weapon.Id)!=SoundCue.None,weapon.Id+" has an audio family");
            var g=PassiveScene(c,weapon.Id);g.TakeSounds();g.Cast(weapon.Id);
            Check((g.TakeSounds()&Simulation.WeaponSound(weapon.Id))!=0,weapon.Id+" successful cast emits audio");
            Check(g.TakeSounds()==SoundCue.None,"Sound events consumed once");
        }
        var empty=Fixture(c);empty.Manual=false;empty.TakeSounds();empty.Cast("needle");empty.Levels["lightning"]=1;empty.Cast("lightning");Check(empty.TakeSounds()==SoundCue.None,"No phantom gun or lightning audio without target");
        var crowd=Fixture(c);var target=crowd.Spawn("brute",crowd.Player.Pos+new Vector2(80,0));target.Hp=target.MaxHp=1000000;crowd.TakeSounds();
        for(int i=0;i<5000;i++)crowd.HurtEnemy(target,1,0,"needle");Check(crowd.TakeSounds()==SoundCue.Hit,"5000 hits coalesce into one flag, no per-enemy queue");
        crowd.SoundSignals=SoundCue.Hurt;Check(!JsonSerializer.Serialize(crowd,SaveStore.JsonOptions).Contains("SoundSignals"),"Transient sounds never replay from saves");crowd.TakeSounds();
        Check(crowd.Dash()&&(crowd.TakeSounds()&SoundCue.Dash)!=0,"Successful dash audio");Check(!crowd.Dash()&&crowd.TakeSounds()==SoundCue.None,"Failed dash stays silent");
        crowd.Player.Invulnerable=0;crowd.HurtPlayer(5);Check((crowd.TakeSounds()&SoundCue.Hurt)!=0,"Actual damage audio");
        crowd.Levels["revive"]=1;crowd.Player.Invulnerable=0;crowd.HurtPlayer(100000);Check((crowd.TakeSounds()&SoundCue.Revive)!=0&&crowd.Status==RunStatus.Running,"Revive audio");
        crowd.Player.Invulnerable=0;crowd.HurtPlayer(100000);Check((crowd.TakeSounds()&SoundCue.Death)!=0&&crowd.Status==RunStatus.Dead,"Death audio");
        var drops=Fixture(c);drops.TakeSounds();drops.AddGem(drops.Player.Pos,1);drops.Tick(1/60f);Check((drops.TakeSounds()&SoundCue.Gem)!=0,"Collected gem audio");
        drops.Player.Hp=40;drops.Hearts.Add(new(){Pos=drops.Player.Pos});drops.Tick(1/60f);Check((drops.TakeSounds()&SoundCue.Heal)!=0,"Collected medicine audio");
        drops.GainXp(10);Check((drops.TakeSounds()&SoundCue.Upgrade)!=0,"Level-up audio");
        var boss=Fixture(c);boss.TakeSounds();var lich=boss.Spawn("lichLord",boss.Player.Pos+new Vector2(100,0));Check((boss.TakeSounds()&SoundCue.Boss)!=0,"Boss spawn audio");boss.HurtEnemy(lich,10000000);Check((boss.TakeSounds()&SoundCue.BossDeath)!=0,"Boss defeated audio");
        Check(boss.OpenChest(boss.Chests[0])&&(boss.TakeSounds()&SoundCue.Chest)!=0,"Chest audio");
    }
}
