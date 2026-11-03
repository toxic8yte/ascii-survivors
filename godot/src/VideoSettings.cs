using Godot;

namespace AsciiSurvivors;

public sealed class VideoSettings
{
    private readonly string path;
    public int Fps {get;private set;}=240;
    public bool VSync {get;private set;}
    public static bool ValidLimit(int value)=>value is 0 or 60 or 120 or 240;
    public VideoSettings(string path)
    {
        this.path=path;using var file=new ConfigFile();if(file.Load(path)!=Error.Ok)return;
        var fps=file.GetValue("video","fps_limit",240);var sync=file.GetValue("video","vsync",false);
        if(fps.VariantType==Variant.Type.Int&&fps.AsInt64() is >=0 and <=240&&ValidLimit((int)fps.AsInt64()))Fps=(int)fps.AsInt64();
        if(sync.VariantType==Variant.Type.Bool)VSync=sync.AsBool();
    }
    public void Set(int fps,bool sync)
    {if(!ValidLimit(fps))throw new ArgumentOutOfRangeException(nameof(fps));Fps=fps;VSync=sync;}
    public void Apply()
    {Engine.MaxFps=Fps;DisplayServer.WindowSetVsyncMode(VSync?DisplayServer.VSyncMode.Enabled:DisplayServer.VSyncMode.Disabled);}
    public Error Save()
    {
        try
        {
            Directory.CreateDirectory(Path.GetDirectoryName(path)!);using var file=new ConfigFile();
            file.SetValue("video","fps_limit",Fps);file.SetValue("video","vsync",VSync);return file.Save(path);
        }
        catch(Exception e)when(e is IOException or UnauthorizedAccessException){return Error.CantCreate;}
    }
}
