# Obsidian Tracker Plugin

A feature-rich plugin for Obsidian that helps you track your daily habits with an intuitive and visually appealing interface.

## Features

- **Multiple Habit Views**: Track your habits in three different ways:
    - **GitHub-style Year View**: A familiar contribution graph showing your activity over the past year.
    - **Month View**: A traditional monthly calendar for a detailed daily view.
    - **Year Overview**: See all 12 months of the year at a glance, perfect for reviewing long-term progress.
- **Comprehensive Habit Management**: Easily add, edit, and delete habits using a clean UI with a custom dropdown selector.
- **Interactive Tracking**: Click on any day in the calendar views to toggle a habit as completed or not completed for that day.
- **Automatic Data Persistence**: All your habit data is automatically saved and loaded with your vault. No manual configuration files needed.
- **Streak Calculation**: The plugin automatically calculates and displays your current habit streak (visible in the GitHub-style view).
- **Responsive Design**: The interface adapts to different screen sizes and Obsidian themes.

<img width="1143" height="546" alt="habitracker" src="https://github.com/user-attachments/assets/a1cf8279-6542-4cad-8a23-56d0448e2eda" />


## How to Use

### 1. Open the Habit Tracker

You can open the Habit Tracker view in several ways:
- Click the calendar icon in the left-hand ribbon.
- Use the command palette (`Ctrl/Cmd+P`) and search for the "Open Habit Tracker" command.

### 2. Add Your First Habit

1.  In the Habit Tracker view, click the **"Add"** button in the control bar.
2.  An "Add Habit" modal will appear. Type the name of your new habit (e.g., "Exercise", "Read 30 minutes").
3.  Click **"Add"** or press `Enter` to save it.

Your new habit will be automatically selected and ready for tracking.

### 3. Track Your Habits

- **Select a Habit**: Use the dropdown menu in the control bar to choose which habit you want to view or track.
- **Mark as Complete**: Click on any day in the calendar view to mark that habit as completed for that day. The day will turn green.
- **Mark as Incomplete**: Click on a completed (green) day to mark it as incomplete. It will revert to its default color.
- **View Different Time Periods**:
    - Use the **view type buttons** (Year, Month, Year Overview) to switch between the different tracking views.
    - In the **Month View**, use the arrow buttons (`◀` and `▶`) to navigate between months, or click **"Today"** to jump back to the current month.
    - In the **Year View** and **Year Overview**, use the year selector on the right to view data from previous years.

### 4. Edit or Delete Habits

- **Edit a Habit**:
    1.  Select the habit you want to edit from the dropdown.
    2.  Click the **"Edit"** button in the control bar.
    3.  An "Edit Habit" modal will appear. Change the name of your habit.
    4.  Click **"Save"** to confirm the change.
- **Delete a Habit**:
    1.  Select the habit you want to delete from the dropdown.
    2.  Click the **"Delete"** button in the control bar.
    3.  A confirmation modal will appear. Click **"Delete"** to permanently remove the habit and all its associated data.

## Installation (Not Yet Active)

⚠️ This plugin is not available in Obsidian Community Plugins yet, but you can install it manually.

### From Obsidian Community Plugins (Planned)

1.  Go to `Settings` > `Community Plugins`.
2.  Disable `Safe mode`.
3.  Click `Browse` and search for "Habit Tracker".
4.  Click `Install` next to the plugin.
5.  Once installed, click `Enable` to activate the plugin.

### Manual Installation

1.  Download the latest release files (`main.js`, `manifest.json`, `styles.css`) from the [GitHub repository](https://github.com/Nodeencoder/Obsidian-Tracker/releases).
2.  Create a new folder named `habit-tracker-obsidian` inside your vault's `.obsidian/plugins/` directory.
3.  Copy the downloaded files into the `habit-tracker-obsidian` folder.
4.  Reload Obsidian (`Ctrl+R` or `Cmd+R`).
5.  Enable the plugin in `Settings` > `Community Plugins`.

## Development

To set up the development environment and build the plugin:

```bash
# Clone the repository
git clone https://github.com/Nodeencoder/Obsidian-Tracker.git
cd Obsidian-Tracker

# Install dependencies
npm install

# Build the plugin for production
npm run build

# Watch for changes during development (rebuilds automatically)
npm run dev
```
After running `npm run dev`, you can load the plugin from the `main.js` file in your local Obsidian development vault for testing.

## License

This plugin is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.
