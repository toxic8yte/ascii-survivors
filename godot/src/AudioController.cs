using Godot;

namespace AsciiSurvivors;

public partial class AudioController : Node
{
    private sealed record Effect(SoundCue Cue,string File,int Priority,float Interval,float Db);
    private static readonly Effect[] effects=[
        new(SoundCue.Death,"death",10,1,-2),new(SoundCue.Revive,"revive",10,1,-3),new(SoundCue.BossDeath,"boss_death",9,1,-3),
        new(SoundCue.Boss,"boss",9,2,-5),new(SoundCue.Hurt,"hurt",8,.25f,-5),new(SoundCue.Evolution,"evolution",8,.5f,-4),
        new(SoundCue.Upgrade,"upgrade",7,.3f,-5),new(SoundCue.Chest,"chest",7,.3f,-5),new(SoundCue.Heal,"heal",6,.2f,-7),
        new(SoundCue.Start,"start",6,.3f,-5),new(SoundCue.Ui,"ui",5,.04f,-12),new(SoundCue.Pause,"pause",5,.1f,-12),
        new(SoundCue.Dash,"dash",5,.15f,-10),new(SoundCue.Shield,"shield",5,.15f,-10),
        new(SoundCue.Electric,"electric",3,.12f,-12),new(SoundCue.Energy,"energy",3,.15f,-12),new(SoundCue.Whip,"whip",3,.12f,-12),
        new(SoundCue.Explosion,"explosion",3,.18f,-14),new(SoundCue.Ice,"ice",3,.2f,-13),new(SoundCue.Magic,"magic",3,.2f,-15),
        new(SoundCue.Metal,"metal",3,.12f,-10),new(SoundCue.Punch,"punch",3,.12f,-10),
        new(SoundCue.Shot,"shot",2,.1f,-14),new(SoundCue.Fire,"fire",2,.16f,-16),new(SoundCue.Melee,"melee",2,.12f,-14),
        new(SoundCue.Water,"water",2,.2f,-15),new(SoundCue.Acid,"acid",2,.25f,-16),new(SoundCue.Orbit,"orbit",2,.25f,-18),
        new(SoundCue.Gem,"gem",1,.11f,-17),new(SoundCue.Kill,"kill",0,.16f,-23),new(SoundCue.Hit,"hit",0,.12f,-25)
    ];
    private sealed class Voice {public AudioStreamPlayer Player=new(){MaxPolyphony=1};public Effect? Effect;}
    private readonly Voice[] voices=Enumerable.Range(0,12).Select(_=>new Voice()).ToArray();
    private readonly AudioStreamPlayer[] music=[new(),new()];
    private readonly Dictionary<string,AudioStream> streams=[];
    private readonly Dictionary<SoundCue,double> next=[];
    private readonly Random random=new(971);
    private readonly float[] fades=[0,0];
    private double clock,sceneClock;
    private float tokens=6,duck=1;
    private int current=-1;
    private bool silent;
    private string settingsPath="";
    public float Master=.75f,Music=.45f,Effects=.65f;
    public string Track {get;private set;}="";
    public int ActiveVoices=>voices.Count(v=>v.Player.Playing);
    public int Played {get;private set;}
    public void Initialize(string path,bool mute=false)
    {
        settingsPath=path;silent=mute;var config=new ConfigFile();
        if(config.Load(path)==Error.Ok){Master=Read(config,"master",Master);Music=Read(config,"music",Music);Effects=Read(config,"effects",Effects);}
        const string busName="NightAudio";int bus=AudioServer.GetBusIndex(busName);
        if(bus<0){AudioServer.AddBus();bus=AudioServer.BusCount-1;AudioServer.SetBusName(bus,busName);AudioServer.SetBusSend(bus,"Master");AudioServer.AddBusEffect(bus,new AudioEffectHardLimiter{CeilingDb=-1});}
        foreach(var effect in effects)streams[effect.File]=GD.Load<AudioStream>("res://Audio/"+effect.File+".wav")??throw new IOException("Missing sound "+effect.File);
        foreach(string name in new[]{"menu","night","boss_music"})
        {
            var wav=GD.Load<AudioStreamWav>("res://Audio/"+name+".wav")??throw new IOException("Missing music "+name);
            wav.LoopMode=AudioStreamWav.LoopModeEnum.Forward;wav.LoopBegin=0;wav.LoopEnd=(int)Math.Round(wav.GetLength()*wav.MixRate);streams[name]=wav;
        }
        foreach(var player in music){player.Bus=busName;AddChild(player);player.VolumeDb=-80;}
        foreach(var voice in voices){voice.Player.Bus=busName;AddChild(voice.Player);}
    }
    private static float Read(ConfigFile file,string key,float fallback)
    {var value=file.GetValue("audio",key,fallback);if(value.VariantType is not (Variant.Type.Float or Variant.Type.Int))return fallback;float n=(float)value.AsDouble();return float.IsFinite(n)?Math.Clamp(n,0,1):fallback;}
    public Error SaveSettings()
    {try{Directory.CreateDirectory(Path.GetDirectoryName(settingsPath)!);var config=new ConfigFile();config.SetValue("audio","master",Master);config.SetValue("audio","music",Music);config.SetValue("audio","effects",Effects);return config.Save(settingsPath);}catch(Exception e)when(e is IOException or UnauthorizedAccessException){return Error.CantCreate;}}
    public void SetVolume(string channel,float volume)
    {
        volume=float.IsFinite(volume)?Math.Clamp(volume,0,1):0;
        if(channel=="master")Master=volume;else if(channel=="music")Music=volume;else if(channel=="effects")Effects=volume;
        foreach(var voice in voices)if(voice.Effect is {} e)voice.Player.VolumeDb=Gain(Master*Effects,e.Db);
        for(int i=0;i<music.Length;i++)music[i].VolumeDb=Gain(Master*Music*fades[i]*duck);
    }
    private float Gain(float linear,float db=0)=>silent||linear<=.0001f?-80:Mathf.LinearToDb(linear)+db;
    public bool Play(SoundCue cue)
    {
        var effect=effects.FirstOrDefault(e=>e.Cue==cue);if(effect is null||clock<next.GetValueOrDefault(cue)||Master*Effects<=.0001f)return false;
        if(effect.Priority<5&&tokens<1)return false;
        var voice=voices.FirstOrDefault(v=>!v.Player.Playing)??voices.MinBy(v=>v.Effect?.Priority??-1)!;
        if(voice.Player.Playing&&(voice.Effect?.Priority??0)>effect.Priority)return false;
        voice.Player.Stop();voice.Effect=effect;voice.Player.Stream=streams[effect.File];voice.Player.VolumeDb=Gain(Master*Effects,effect.Db);
        voice.Player.PitchScale=effect.Priority>=5?1:1+(float)(random.NextDouble()-.5)*.08f;
        voice.Player.Play();Played++;next[cue]=clock+effect.Interval;if(effect.Priority<5)tokens--;return true;
    }
    private void SetTrack(string name)
    {
        if(name==Track)return;current=(current+1)%2;music[current].Stop();music[current].Stream=streams[name];music[current].VolumeDb=-80;fades[current]=0;music[current].Play();Track=name;
    }
    public void Update(Simulation game,bool menuVisible,double delta)
    {
        clock+=delta;sceneClock-=delta;tokens=Math.Min(6,tokens+(float)delta*24);
        var pending=game.TakeSounds();if((pending&SoundCue.Death)!=0)pending=SoundCue.Death;foreach(var effect in effects)if((pending&effect.Cue)!=0)Play(effect.Cue);
        if(sceneClock<=0||Track.Length==0)
        {sceneClock=.4;SetTrack(game.Status==RunStatus.Ready?"menu":game.Arena is not null||game.Enemies.Any(e=>e.Alive&&e.Def.Boss)?"boss_music":"night");}
        float target=game.Status==RunStatus.Ready||game.Status==RunStatus.Running&&!menuVisible?1:.3f;duck=Mathf.Lerp(duck,target,(float)(1-Math.Exp(-delta*5)));
        for(int i=0;i<music.Length;i++)
        {
            fades[i]=Mathf.MoveToward(fades[i],i==current?1:0,(float)delta/1.5f);music[i].VolumeDb=Gain(Master*Music*fades[i]*duck);
            if(i!=current&&fades[i]==0&&music[i].Playing)music[i].Stop();
        }
    }
    public override void _ExitTree()
    {
        foreach(var player in music){player.Stop();player.Stream=null;}
        foreach(var voice in voices){voice.Player.Stop();voice.Player.Stream=null;voice.Effect=null;}
        streams.Clear();
    }
}
