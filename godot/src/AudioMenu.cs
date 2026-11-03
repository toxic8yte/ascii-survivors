using Godot;

namespace AsciiSurvivors;

public partial class Main
{
    private void ShowAudio()
    {
        PrepareAux();var body=Modal("audio","Звук","Тёмный эмбиент: меню, ночь и босс. Музыка в меню паузы звучит тише.",true,width:620);
        foreach(var (channel,title,value) in new[]{("master","ОБЩАЯ ГРОМКОСТЬ",audio.Master),("music","МУЗЫКА",audio.Music),("effects","ЭФФЕКТЫ",audio.Effects)})
        {
            var line=new HBoxContainer();body.AddChild(line);var label=Label(title,16,parchment);label.SizeFlagsHorizontal=Control.SizeFlags.ExpandFill;line.AddChild(label);var percent=Label(Math.Round(value*100)+"%",16,amber);line.AddChild(percent);
            var slider=new HSlider{Name="Volume-"+channel,MinValue=0,MaxValue=100,Step=1,Value=value*100,CustomMinimumSize=new(0,28),SizeFlagsHorizontal=Control.SizeFlags.ExpandFill};body.AddChild(slider);
            slider.ValueChanged+=volume=>{audio.SetVolume(channel,(float)volume/100);percent.Text=Math.Round(volume)+"%";if(audio.SaveSettings()!=Error.Ok)Toast("НЕ УДАЛОСЬ СОХРАНИТЬ ГРОМКОСТЬ");};
        }
        body.AddChild(Paragraph("0% — выключить канал. Атаки, попадания, кристаллы, усиления и боссы имеют отдельные эффекты. Настройки сохраняются между запусками.",14,muted));
        body.AddChild(Button("ПРОВЕРИТЬ ЭФФЕКТ",()=>audio.Play(SoundCue.Chest)));
        body.AddChild(Button("ГОТОВО →",CloseAux,true));
    }
}
