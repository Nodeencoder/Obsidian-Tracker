import { App, PluginSettingTab, Setting } from 'obsidian';
import type HabitTrackerPlugin from './main';

export class HabitTrackerSettingTab extends PluginSettingTab {
  plugin: HabitTrackerPlugin;

  constructor(app: App, plugin: HabitTrackerPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    containerEl.createEl('h2', { text: 'Habit Tracker Settings' });

    new Setting(containerEl)
      .setName('Habits File Path')
      .setDesc('Path to the markdown file containing your list of habits (e.g., habits.md)')
      .addText(text => text
        .setPlaceholder('habits.md')
        .setValue(this.plugin.settings.habitsFilePath)
        .onChange(async (value) => {
          this.plugin.settings.habitsFilePath = value;
          await this.plugin.saveSettings();
          this.plugin.refreshView();
        }));
  }
}
