using Godot;

namespace AsciiSurvivors;

public partial class Main
{
    private Label? settingsFps;
    private void ShowSettings()
    {
        PrepareAux();var body=Modal("settings","Настройки","Изменения применяются сразу и сохраняются между запусками.",true,width:700);
        var tabs=new TabContainer{Name="SettingsTabs",CustomMinimumSize=new(0,360)};body.AddChild(tabs);
        var displayMargin=Margin(18);displayMargin.Name="Видео";tabs.AddChild(displayMargin);var display=new VBoxContainer();Gap(display,12);displayMargin.AddChild(display);
        display.AddChild(Label("ВЕРХНИЙ ПРЕДЕЛ FPS",16,amber));
        var limit=Combo(new[]{("60","60 FPS"),("120","120 FPS"),("240","240 FPS"),("0","БЕЗ ОГРАНИЧЕНИЯ")},video.Fps.ToString(),id=>ApplyVideo(int.Parse(id),video.VSync));limit.Name="FpsLimit";display.AddChild(limit);
        var sync=new CheckButton{Name="VSync",Text="VSync — синхронизация с монитором",ButtonPressed=video.VSync};display.AddChild(sync);sync.Toggled+=enabled=>ApplyVideo(video.Fps,enabled);
        display.AddChild(Paragraph("VSync ограничивает FPS частотой монитора. Чтобы снять ограничение 60 Гц, выключи VSync. Лимит FPS задаёт максимум, а фактическая частота зависит от нагрузки.",14,muted));
        display.AddChild(Button("ПОЛНОЭКРАННЫЙ / ОКОННЫЙ РЕЖИМ [G]",ToggleFullscreen));
        settingsFps=Label("ФАКТИЧЕСКИ: "+Engine.GetFramesPerSecond()+" FPS",14,amber);display.AddChild(settingsFps);
        var soundMargin=Margin(18);soundMargin.Name="Звук";tabs.AddChild(soundMargin);var sound=new VBoxContainer();Gap(sound,9);soundMargin.AddChild(sound);
        foreach(var (channel,title,value) in new[]{("master","ОБЩАЯ ГРОМКОСТЬ",audio.Master),("music","МУЗЫКА",audio.Music),("effects","ЭФФЕКТЫ",audio.Effects)})
        {
            var line=new HBoxContainer();sound.AddChild(line);var label=Label(title,16,parchment);label.SizeFlagsHorizontal=Control.SizeFlags.ExpandFill;line.AddChild(label);var percent=Label(Math.Round(value*100)+"%",16,amber);line.AddChild(percent);
            var slider=new HSlider{Name="Volume-"+channel,MinValue=0,MaxValue=100,Step=1,Value=value*100,CustomMinimumSize=new(0,28),SizeFlagsHorizontal=Control.SizeFlags.ExpandFill};sound.AddChild(slider);
            slider.ValueChanged+=volume=>{audio.SetVolume(channel,(float)volume/100);percent.Text=Math.Round(volume)+"%";if(audio.SaveSettings()!=Error.Ok)Toast("НЕ УДАЛОСЬ СОХРАНИТЬ ГРОМКОСТЬ");};
        }
        sound.AddChild(Paragraph("0% — выключить канал. Музыка в меню паузы звучит тише.",14,muted));
        sound.AddChild(Button("ПРОВЕРИТЬ ЭФФЕКТ",()=>audio.Play(SoundCue.Chest)));
        body.AddChild(Button("ГОТОВО →",CloseAux,true));
    }
    private void ApplyVideo(int fps,bool sync)
    {video.Set(fps,sync);video.Apply();if(video.Save()!=Error.Ok)Toast("НЕ УДАЛОСЬ СОХРАНИТЬ НАСТРОЙКИ ВИДЕО");}
}
