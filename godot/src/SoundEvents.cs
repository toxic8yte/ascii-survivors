using System.Text.Json.Serialization;

namespace AsciiSurvivors;

[Flags]
public enum SoundCue : ulong
{
    None=0,Shot=1UL<<0,Fire=1UL<<1,Electric=1UL<<2,Energy=1UL<<3,Melee=1UL<<4,Whip=1UL<<5,
    Magic=1UL<<6,Explosion=1UL<<7,Ice=1UL<<8,Acid=1UL<<9,Water=1UL<<10,Orbit=1UL<<11,
    Hit=1UL<<12,Kill=1UL<<13,Hurt=1UL<<14,Gem=1UL<<15,Dash=1UL<<16,Shield=1UL<<17,
    Boss=1UL<<18,Death=1UL<<19,Ui=1UL<<20,Pause=1UL<<21,Heal=1UL<<22,Chest=1UL<<23,
    Upgrade=1UL<<24,Evolution=1UL<<25,BossDeath=1UL<<26,Revive=1UL<<27,Start=1UL<<28
}

public sealed partial class Simulation
{
    // Coalesce identical events in a tick without allocating one event per enemy.
    [JsonIgnore] public SoundCue SoundSignals;
    public SoundCue TakeSounds(){var pending=SoundSignals;SoundSignals=SoundCue.None;return pending;}
    public static SoundCue WeaponSound(string id)=>id switch
    {
        "needle" or "fireball" or "flamethrower"=>SoundCue.Fire,
        "lightning" or "electropistol"=>SoundCue.Electric,
        "gauss" or "chozo" or "plasmaMinigun"=>SoundCue.Energy,
        "dagger" or "axe" or "pistol" or "sling" or "crossbow"=>SoundCue.Shot,
        "whip"=>SoundCue.Whip,"crowbar" or "gauntlets" or "hammer" or "blades" or "boomerang"=>SoundCue.Melee,
        "water"=>SoundCue.Water,"poison"=>SoundCue.Acid,"frost" or "clock"=>SoundCue.Ice,"laurel"=>SoundCue.Shield,
        "garlic" or "bible"=>SoundCue.Orbit,
        "meteor" or "pulse" or "lightStaff" or "pentagram" or "rune" or "birds" or "ebony"=>SoundCue.Magic,
        _=>SoundCue.None
    };
}
