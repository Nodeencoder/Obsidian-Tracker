import { ItemView, WorkspaceLeaf, Modal, Setting, setIcon } from 'obsidian';
import type HabitTrackerPlugin from './main';

export const VIEW_TYPE_HABIT_TRACKER = 'habit-tracker-view';

type ViewType = 'year' | 'month' | 'year-overview' | 'today';

export class HabitTrackerView extends ItemView {
  plugin: HabitTrackerPlugin;
  private selectedHabit: string | null = null;
  // Default to today view so the UI opens on the Today's overview by default
  private viewType: ViewType = 'today';
  private selectedMonth: Date = new Date();
  private selectedYear: number = new Date().getFullYear();
  // months the user has "unlocked" (clicked) in the Year Overview so they become active
  private unlockedMonths: Set<number> = new Set();

  constructor(leaf: WorkspaceLeaf, plugin: HabitTrackerPlugin) {
    super(leaf);
    this.plugin = plugin;
    this.selectedMonth.setDate(1);
  }

  getViewType(): string {
    return VIEW_TYPE_HABIT_TRACKER;
  }

  getDisplayText(): string {
    return 'Habit Tracker';
  }

  getIcon(): string {
    return 'calendar-check';
  }

  async onOpen(): Promise<void> {
    await this.render();
  }

  async render(): Promise<void> {
    console.log('RENDER START: selectedHabit =', this.selectedHabit, 'Type:', typeof this.selectedHabit);
    const container = this.containerEl.children[1] as HTMLElement;
    container.empty();
    container.addClass('habit-tracker-container');

    // Render controls and get the controls element so we can measure its height
    const controlsEl = this.renderControls(container);

    // Create a content wrapper so we can guarantee all rendered views start below the controls.
    const contentWrapper = container.createEl('div', { cls: 'habit-content' });

    // Ensure content is pushed below controls: measure and apply margin-top. Also update on resize.
    const applyOffset = () => {
      try {
        const h = (controlsEl as HTMLElement).getBoundingClientRect().height || 0;
  // Reduce how far content is pushed down: use a fraction of controls height
  // so the content appears higher but still below the controls. Keep a small
  // minimum gap so they're not touching.
  const offset = Math.max(4, Math.ceil(h * 0.4));
        contentWrapper.style.marginTop = `${offset}px`;
        // Smooth small moves when resizing
        contentWrapper.style.transition = 'margin-top 120ms ease';
      } catch (e) {
        // ignore measurement errors
      }
    };

    // Use RAF so the DOM is stable when measuring
    requestAnimationFrame(applyOffset);
    // Update on window resize to handle wrapping controls
    window.addEventListener('resize', applyOffset);

    const habits = this.plugin.dataStore.getHabits();
    console.log('RENDER: Habits from store =', habits);

    if (habits.length === 0) {
      container.createEl('div', {
        text: 'No habits yet. Click "Add New Habit" to get started!',
        cls: 'no-habits-message'
      });
      console.log('RENDER: No habits, exiting.');
      return;
    }

    // If a habit is selected but no longer exists (e.g., deleted from another view),
    // or if no habit is selected at all, default to the first one.
    if (!this.selectedHabit || !habits.includes(this.selectedHabit)) {
      if (habits.length > 0) {
        this.selectedHabit = habits[0];
      } else {
        // No habits to select, ensure buttons are disabled and exit.
        this.selectedHabit = null;
        container.createEl('div', {
          text: 'No habits yet. Click "Add New Habit" to get started!',
          cls: 'no-habits-message'
        });
        return;
      }
    }

    // Render based on selected view. For 'year' we now show all habits (not only selected).
    if (this.viewType === 'year') {
      // renderYearView will iterate all habits when no habitName is provided
      this.renderYearView(contentWrapper);
    } else if (this.viewType === 'month') {
      // Month view shows all habits
      this.renderMonthView(contentWrapper);
    } else if (this.viewType === 'today') {
      this.renderTodayView(contentWrapper);
    } else if (this.viewType === 'year-overview') {
      // Year overview still targets the selected habit if present
      this.renderYearOverview(contentWrapper, this.selectedHabit || (this.plugin.dataStore.getHabits()[0] || ''));
    }
  }

  private renderTodayView(container: HTMLElement): void {
    const habits = this.plugin.dataStore.getHabits();
    if (!habits || habits.length === 0) return;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Determine current week's Monday as start
    const dayOfWeek = (today.getDay() + 6) % 7; // 0 = Monday
    const monday = new Date(today);
    monday.setDate(today.getDate() - dayOfWeek);

    const weekDates: Date[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      weekDates.push(d);
    }

    const todayStr = this.formatDate(today);

    const todaySection = container.createEl('div', { cls: 'today-overview' });
    const header = todaySection.createEl('h2', { text: 'Today', cls: 'today-title' });

    const cardsContainer = todaySection.createEl('div', { cls: 'today-cards-container' });

    habits.forEach(habit => {
      // Count completions in current week
      let weekCount = 0;
      weekDates.forEach(d => {
        if (this.plugin.dataStore.isHabitCompleted(habit, this.formatDate(d))) weekCount++;
      });

      const card = cardsContainer.createEl('div', { cls: 'today-card habit-section' });

      const left = card.createEl('div', { cls: 'today-card-left' });
      left.createEl('div', { text: String(weekCount), cls: 'today-count-number' });
      left.createEl('div', { text: weekCount === 1 ? 'DAY' : 'DAYS', cls: 'today-count-label' });

      const right = card.createEl('div', { cls: 'today-card-right' });
      const checkBtn = right.createEl('button', { cls: 'today-check-button' });
      // show tick if today is completed for this habit
      const isTodayCompleted = this.plugin.dataStore.isHabitCompleted(habit, todayStr);
      checkBtn.createEl('span', { text: isTodayCompleted ? '✓' : '' , cls: 'today-check-mark' });
      if (isTodayCompleted) checkBtn.addClass('active');

      // Apply habit color if present
      const habitColor = this.plugin.dataStore.getHabitColor(habit);
      if (habitColor) {
        // If today is completed: style the card and check button with habit color
        if (isTodayCompleted) {
          card.addClass('active-today');
          // use a lighter (more opaque) version for the card background so the card looks softer
          card.style.background = this.hexToRgba(habitColor, 0.12);
          // ensure text has good contrast
          card.style.color = this.getContrastColor(habitColor);
          // check button should use the full intense color when active
          checkBtn.style.backgroundColor = habitColor;
          checkBtn.classList.add('active');
          // add a subtle glow using the habit color
          checkBtn.style.boxShadow = `0 8px 20px ${this.hexToRgba(habitColor, 0.18)}`;
        }
      } else {
        if (isTodayCompleted) {
          card.addClass('active-today');
        }
      }

      checkBtn.addEventListener('click', async () => {
        this.plugin.dataStore.toggleHabit(habit, todayStr);
        await this.render();
      });

      // Habit name and week row
      const middle = card.createEl('div', { cls: 'today-card-middle' });
      middle.createEl('div', { text: habit, cls: 'today-habit-name' });

      const weekRow = middle.createEl('div', { cls: 'today-week-row' });
  // Single-letter weekday initials starting from Monday: M, T, W, T, F, S, S
  const dayLabels = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
      weekDates.forEach((d, idx) => {
        const dStr = this.formatDate(d);
        const sq = weekRow.createEl('div', { cls: 'today-week-square' });
        // add the day initial/label inside the square
        const label = dayLabels[idx] || '';
        sq.createEl('span', { text: label, cls: 'today-week-initial' });

        const completed = this.plugin.dataStore.isHabitCompleted(habit, dStr);
        if (completed) {
          sq.addClass('completed');
          if (habitColor) {
            sq.style.backgroundColor = habitColor;
            sq.style.boxShadow = `0 6px 14px ${this.hexToRgba(habitColor, 0.14)}`;
          }
        }
        if (this.isSameDay(d, today)) {
          sq.addClass('today');
          if (!completed && habitColor) {
            sq.style.backgroundColor = this.hexToRgba(habitColor, 0.12);
            sq.style.outline = `2px solid ${this.hexToRgba(habitColor, 0.18)}`;
          }
        }
      });

      middle.createEl('div', { text: `${weekCount}/7`, cls: 'today-week-count' });
    });
  }

  private renderControls(container: HTMLElement): HTMLElement {
    const controlsSection = container.createEl('div', { cls: 'habit-controls' });

    const addButton = controlsSection.createEl('button', {
      text: 'Add',
      cls: 'habit-control-button'
    });
    addButton.addEventListener('click', () => {
      new AddHabitModal(this.app, this.plugin, async () => {
        await this.render();
      }).open();
    });

    const habits = this.plugin.dataStore.getHabits();

    if (habits.length > 0) {
      const selectorContainer = controlsSection.createEl('div', { cls: 'habit-selector-container' });


      const customDropdown = selectorContainer.createEl('div', { cls: 'custom-habit-dropdown' });

      const dropdownButton = customDropdown.createEl('button', { cls: 'habit-dropdown-button' });
      dropdownButton.createEl('span', { text: this.selectedHabit || 'Select Habit', cls: 'habit-dropdown-text' });
      dropdownButton.createEl('span', { text: '▼', cls: 'habit-dropdown-arrow' });

      const dropdownMenu = customDropdown.createEl('div', { cls: 'habit-dropdown-menu' });

      habits.forEach(habit => {
        const item = dropdownMenu.createEl('div', { cls: 'habit-dropdown-item' });

        if (habit === this.selectedHabit) {
          item.addClass('active');
        }

        const habitText = item.createEl('span', { text: habit, cls: 'habit-item-text' });
        // Attach the click handler to the full item so the whole row is clickable
        item.addEventListener('click', async (e) => {
          e.stopPropagation();
          this.selectedHabit = habit;
          dropdownMenu.removeClass('show');
          await this.render();
        });
        // Also make the inner text non-interfering for clicks
        habitText.style.pointerEvents = 'none';
      });

      dropdownButton.addEventListener('click', (e) => {
        e.stopPropagation();
        const isShown = dropdownMenu.hasClass('show');
        if (isShown) {
          dropdownMenu.removeClass('show');
        } else {
          dropdownMenu.addClass('show');
        }
      });

      this.registerDomEvent(document, 'click', (e: MouseEvent) => {
        if (!customDropdown.contains(e.target as Node)) {
          dropdownMenu.removeClass('show');
        }
      });

      console.log('Rendering Edit Button. selectedHabit:', this.selectedHabit, 'Type:', typeof this.selectedHabit);
      const editButton = controlsSection.createEl('button', {
        text: 'Edit',
        cls: 'habit-control-button'
      });
      editButton.disabled = !this.selectedHabit;
      editButton.addEventListener('click', () => {
        if (this.selectedHabit) {
          new EditHabitModal(this.app, this.plugin, this.selectedHabit, async (newName) => {
            this.selectedHabit = newName;
            await this.render();
          }).open();
        }
      });

      const deleteButton = controlsSection.createEl('button', {
        text: 'Delete',
        cls: 'habit-control-button'
      });
      deleteButton.disabled = !this.selectedHabit;
      deleteButton.addEventListener('click', () => {
        if (this.selectedHabit) {
          new DeleteHabitModal(this.app, this.plugin, this.selectedHabit, async () => {
            this.selectedHabit = null;
            await this.render();
          }).open();
        }
      });

      const viewControlsContainer = controlsSection.createEl('div', { cls: 'view-controls-container' });


      const radioGroup = viewControlsContainer.createEl('div', { cls: 'view-radio-group' });

      // Order: Today, Month, Year Overview, Year (swapped per user request)
      // Label changes: 'year-overview' shows 'Year'; 'year' shows 'ALL'
      const viewOptions = [
        { value: 'today', text: 'Today', title: "Today's habits overview" },
        { value: 'month', text: 'Month', title: 'Traditional monthly calendar' },
        { value: 'year-overview', text: 'Year', title: 'All 12 months at a glance' },
        { value: 'year', text: 'All', title: 'GitHub-style contribution grid' }
      ];

      viewOptions.forEach(option => {
        const radioLabel = radioGroup.createEl('label', { cls: 'view-radio-label' });

        // Apply the fixed-width class to the 'year-overview' option (displayed as
        // "Year") so it remains compact; the 'year' option (displayed as "All")
        // should size to its text and not be forced to 80px.
        if (option.value === 'year-overview') {
          radioLabel.addClass('view-radio-year-overview');
        }

        const radioInput = radioLabel.createEl('input', {
          type: 'radio',
          attr: {
            name: 'view-type',
            value: option.value
          },
          cls: 'view-radio-input'
        });

        if (option.value === this.viewType) {
          radioInput.checked = true;
        }

        radioInput.addEventListener('change', async () => {
          if (radioInput.checked) {
            this.viewType = option.value as ViewType;
            await this.render();
          }
        });

        radioLabel.createEl('span', { text: option.text, cls: 'view-radio-text' });
        radioLabel.setAttribute('title', option.title);
      });

      // Global month navigation removed: per-habit month nav is used instead.
    }

    // Add a settings button at the far right of the controls bar. It opens a
    // small menu when clicked. We create the menu inside the controlsSection
    // and position it to the far right using CSS (see styles.css).
    const controlsRight = controlsSection.createEl('div', { cls: 'controls-right' });
    // spacer ensures previous items remain grouped to the left
    controlsRight.style.marginLeft = 'auto';

    const settingsBtn = controlsRight.createEl('button', {
      cls: 'habit-settings-button',
      attr: { type: 'button', title: 'Settings' }
    });
    // use a stroke-only gear SVG (similar style to Obsidian's gear icon)
    settingsBtn.setAttr('aria-label', 'Settings');
    // Use Obsidian's native settings icon for a pixel-perfect match
    try {
      setIcon(settingsBtn, 'settings');
    } catch (e) {
      // Fallback: if setIcon isn't available for some reason, leave the button text
      settingsBtn.setText('\u2699'); // gear unicode as fallback
    }

    const settingsMenu = controlsSection.createEl('div', { cls: 'settings-menu' });
    settingsMenu.createEl('div', { text: 'Export Data', cls: 'settings-menu-item' });
    settingsMenu.createEl('div', { text: 'Import Data', cls: 'settings-menu-item' });
    settingsMenu.createEl('div', { text: 'Preferences', cls: 'settings-menu-item' });
    settingsMenu.createEl('div', { text: 'About', cls: 'settings-menu-item' });

    // Hide initially
    settingsMenu.addClass('hidden');

    // Toggle menu visibility
    settingsBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (settingsMenu.hasClass('hidden')) {
        settingsMenu.removeClass('hidden');
        settingsMenu.addClass('show');
      } else {
        settingsMenu.addClass('hidden');
        settingsMenu.removeClass('show');
      }
    });

    // Close menu when clicking outside
    this.registerDomEvent(document, 'click', (e: MouseEvent) => {
      if (!controlsSection.contains(e.target as Node)) {
        settingsMenu.addClass('hidden');
        settingsMenu.removeClass('show');
      }
    });

    // Simple handlers for menu items
    Array.from(settingsMenu.children).forEach((child: Element) => {
      child.addEventListener('click', async (e) => {
        e.stopPropagation();
        const txt = (child as HTMLElement).innerText.trim();
        // close menu
        settingsMenu.addClass('hidden');
        settingsMenu.removeClass('show');
        // implement basic actions; real implementations can be added later
        if (txt === 'Export Data') {
          // trigger plugin export (if available)
          if (this.plugin && typeof (this.plugin as any).exportData === 'function') {
            (this.plugin as any).exportData();
          } else {
            console.log('Export Data clicked');
          }
        } else if (txt === 'Import Data') {
          if (this.plugin && typeof (this.plugin as any).importData === 'function') {
            (this.plugin as any).importData();
          } else {
            console.log('Import Data clicked');
          }
        } else if (txt === 'Preferences') {
          // Open the plugin-specific settings tab if possible. Use the plugin
          // manifest id as the preferred argument to openSettingTab.
          try {
            const appAny = (this.app as any);
            const pluginId = this.plugin && (this.plugin as any).manifest && (this.plugin as any).manifest.id ? (this.plugin as any).manifest.id : undefined;
            if (appAny && typeof appAny.openSettingTab === 'function') {
              if (pluginId) {
                try { appAny.openSettingTab(pluginId); } catch (e) { appAny.openSettingTab(); }
              } else {
                appAny.openSettingTab();
              }
            } else {
              console.log('Preferences clicked - openSettingTab not available');
            }
          } catch (e) {
            console.log('Error opening preferences', e);
          }
        } else if (txt === 'About') {
          new Modal(this.app).open();
        }
      });
    });

    // Return the controls element so callers can measure it and adjust layout
    return controlsSection;
  }

  private renderYearView(container: HTMLElement, habitName?: string): void {
    const habitsToRender = habitName ? [habitName] : this.plugin.dataStore.getHabits();

    const currentYear = new Date().getFullYear();

    habitsToRender.forEach(habit => {
      const section = container.createEl('div', { cls: 'habit-section github-style' });

  const header = section.createEl('div', { cls: 'github-header' });
  header.createEl('div', { text: habit, cls: 'habit-name' });

  // Year selector placed inline on the same header row (to the right)
  const headerYearSelector = header.createEl('div', { cls: 'github-year-selector' });

  const yearContainer = section.createEl('div', { cls: 'github-year-container' });
  const graphContainer = yearContainer.createEl('div', { cls: 'github-graph-container' });

      // Responsive square grid: columns adapt to available width so wider panes
      // show more columns (fewer rows) and narrow panes show fewer columns (more rows).
      // We build the grid dynamically and rebuild on resize.
      const grid = graphContainer.createEl('div', { cls: 'github-square-grid' });

      const startDate = new Date(this.selectedYear, 0, 1);
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const buildGrid = () => {
        // clear any existing cells
        grid.empty();

        const CELL_PX = 12; // cell size in px (keep in sync with CSS)
        const GAP_PX = 3; // grid gap in px (keep in sync with CSS)

        // measure container width; if zero fall back to a default columns count
        const containerWidth = Math.max(0, graphContainer.getBoundingClientRect().width || 0);

        // compute columns that fit: (width + gap) / (cell + gap)
        let cols = containerWidth > 0 ? Math.floor((containerWidth + GAP_PX) / (CELL_PX + GAP_PX)) : 30;
        // reasonable clamps: never fewer than 7, never more than 60
        cols = Math.min(Math.max(cols, 7), 60);

        // days in selected year (handles leap years)
        const daysInYear = (new Date(this.selectedYear + 1, 0, 1).getTime() - new Date(this.selectedYear, 0, 1).getTime()) / (24 * 60 * 60 * 1000);

        const rows = Math.max(1, Math.ceil(daysInYear / cols));

        // set explicit inline grid sizing to ensure measured layout
        grid.style.gridTemplateColumns = `repeat(${cols}, ${CELL_PX}px)`;
        grid.style.gridTemplateRows = `repeat(${rows}, ${CELL_PX}px)`;
        grid.style.gap = `${GAP_PX}px`;
        grid.style.justifyContent = 'start';
        grid.style.alignContent = 'start';

        const totalCells = rows * cols;

        for (let i = 0; i < totalCells; i++) {
          const currentDate = new Date(startDate);
          currentDate.setDate(startDate.getDate() + i);
          const dateStr = this.formatDate(currentDate);

          const cell = grid.createEl('div', { cls: 'github-cell' });
          const row = Math.floor(i / cols) + 1;
          const col = (i % cols) + 1;
          cell.style.gridColumn = `${col}`;
          cell.style.gridRow = `${row}`;

          if (currentDate.getFullYear() !== this.selectedYear) {
            cell.addClass('outside-year');
          } else {
            const isCompleted = this.plugin.dataStore.isHabitCompleted(habit, dateStr);
            const habitColor = this.plugin.dataStore.getHabitColor(habit);
            if (isCompleted) {
              cell.addClass('completed');
              if (habitColor) {
                cell.style.backgroundColor = habitColor;
              }
            }

            if (this.isSameDay(currentDate, today)) {
              cell.addClass('today');
              if (!isCompleted && habitColor) {
                cell.style.backgroundColor = this.hexToRgba(habitColor, 0.12);
                cell.style.outline = `2px solid ${this.hexToRgba(habitColor, 0.18)}`;
              }
            }

            cell.setAttribute('data-date', dateStr);
            cell.setAttribute('title', `${habit} - ${dateStr}`);

            cell.addEventListener('click', () => {
              const newState = this.plugin.dataStore.toggleHabit(habit, dateStr);
              if (newState) {
                cell.addClass('completed');
                if (habitColor) cell.style.backgroundColor = habitColor;
              } else {
                cell.removeClass('completed');
                cell.style.backgroundColor = '';
                cell.style.outline = '';
              }
            });
          }
        }
      };

      // initial build once DOM layout is stable
      requestAnimationFrame(buildGrid);

      // Rebuild on window resize as a fallback
      this.registerDomEvent(window, 'resize', () => requestAnimationFrame(buildGrid));

      // Also observe size changes of the graph container itself. This catches
      // layout changes caused by expanding/collapsing the controls bar or other
      // panel adjustments that don't trigger a window resize.
      try {
        // If this specific graphContainer already has an observer, disconnect it
        const prevRO = (graphContainer as any).__yearGridRO;
        if (prevRO && typeof prevRO.disconnect === 'function') {
          try { prevRO.disconnect(); } catch (e) {}
        }

        const ro = new ResizeObserver(() => {
          requestAnimationFrame(buildGrid);
        });
        ro.observe(graphContainer);
        // store observer on the specific container so each habit's grid is observed
        (graphContainer as any).__yearGridRO = ro;
      } catch (e) {
        // ResizeObserver may not be available in some environments; ignore.
      }

      const earliestYear = this.getEarliestYearWithData(habit);
      const startYear = Math.min(earliestYear, currentYear);

      for (let year = startYear; year <= currentYear; year++) {
        const yearButton = headerYearSelector.createEl('button', {
          text: year.toString(),
          cls: 'github-year-button'
        });

        if (year === this.selectedYear) {
          yearButton.addClass('active');
        }

        if (year === currentYear) {
          yearButton.addClass('current-year');
        }

        yearButton.addEventListener('click', async () => {
          this.selectedYear = year;
          await this.render();
        });
      }
    });
  }

  private renderMonthView(container: HTMLElement, habitName?: string): void {
    const habitsToRender = habitName ? [habitName] : this.plugin.dataStore.getHabits();

    // Per-habit month state: allow each habit to track its own displayed month.
    // `this.habitMonths` will be a map from habit name -> Date. Initialize lazily.
    if (!('habitMonths' in this)) {
      // @ts-ignore - add a runtime map without changing the class signature elsewhere
      (this as any).habitMonths = new Map<string, Date>();
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Render a calendar section for each habit. Each habit uses its own month state.
    habitsToRender.forEach(habit => {
      const section = container.createEl('div', { cls: 'habit-section calendar-view' });

      // Ensure we have a Date instance for this habit's currently-displayed month
      // Clone the global selectedMonth as a starting point when absent.
      // Use a local variable `habitMonth` for all month-specific calculations below.
      // @ts-ignore
      const habitMonths: Map<string, Date> = (this as any).habitMonths;
      if (!habitMonths.has(habit)) {
        habitMonths.set(habit, new Date(this.selectedMonth));
      }
      const habitMonth = new Date(habitMonths.get(habit) as Date);

  // Header: habit name (left) and month/year navigation (center/right)
  const headerRow = section.createEl('div', { cls: 'calendar-header' });
  const headerLeft = headerRow.createEl('div', { cls: 'calendar-header-left' });
  headerLeft.createEl('div', { text: habit, cls: 'habit-name calendar-habit-name' });

      // Per-habit month navigation: show prev/next arrows and month label above each habit
      const monthNavInline = headerRow.createEl('div', { cls: 'calendar-header-title month-nav-inline' });
      const prevBtn = monthNavInline.createEl('button', { text: '◀', cls: 'month-nav-button' });
      const monthLabel = monthNavInline.createEl('div', { text: habitMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }), cls: 'calendar-month-title' });
      const nextBtn = monthNavInline.createEl('button', { text: '▶', cls: 'month-nav-button' });

      prevBtn.addEventListener('click', async () => {
        // shift only this habit's displayed month back one
        const m = new Date(habitMonth);
        m.setMonth(m.getMonth() - 1);
        habitMonths.set(habit, m);
        await this.render();
      });

      nextBtn.addEventListener('click', async () => {
        // shift only this habit's displayed month forward one
        const m = new Date(habitMonth);
        m.setMonth(m.getMonth() + 1);
        habitMonths.set(habit, m);
        await this.render();
      });

      const calendar = section.createEl('div', { cls: 'calendar-month' });

      // Weekday labels starting on Monday to match the iPhone layout
      const weekDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
      const weekDayHeader = calendar.createEl('div', { cls: 'calendar-weekdays' });
      weekDays.forEach(day => {
        weekDayHeader.createEl('div', { text: day, cls: 'calendar-weekday' });
      });

      const daysGrid = calendar.createEl('div', { cls: 'calendar-days-grid' });

      // Compute month-specific date info from habitMonth
      const year = habitMonth.getFullYear();
      const month = habitMonth.getMonth();
      const firstDay = new Date(year, month, 1);
      const lastDay = new Date(year, month + 1, 0);
      // Shift so week starts on Monday (0 = Monday, 6 = Sunday)
      const startingDayOfWeek = (firstDay.getDay() + 6) % 7;

      for (let i = 0; i < startingDayOfWeek; i++) {
        daysGrid.createEl('div', { cls: 'calendar-day empty' });
      }

      for (let day = 1; day <= lastDay.getDate(); day++) {
        const currentDate = new Date(year, month, day);
        const dateStr = this.formatDate(currentDate);

        const dayCell = daysGrid.createEl('div', { cls: 'calendar-day' });
        dayCell.createEl('div', { text: day.toString(), cls: 'calendar-day-number' });

        const isCompleted = this.plugin.dataStore.isHabitCompleted(habit, dateStr);
        const habitColor = this.plugin.dataStore.getHabitColor(habit);
        if (isCompleted) {
          dayCell.addClass('completed');
          if (habitColor) {
            dayCell.style.backgroundColor = habitColor;
            const num = dayCell.querySelector('.calendar-day-number') as HTMLElement;
            if (num) num.style.color = this.getContrastColor(habitColor);
          }
        }

        if (this.isSameDay(currentDate, today)) {
          dayCell.addClass('today');
          if (!isCompleted && habitColor) {
            dayCell.style.backgroundColor = this.hexToRgba(habitColor, 0.12);
            dayCell.style.outline = `2px solid ${this.hexToRgba(habitColor, 0.18)}`;
            const num = dayCell.querySelector('.calendar-day-number') as HTMLElement;
            if (num) num.style.color = this.getContrastColor(habitColor);
          }
        }

        dayCell.setAttribute('data-date', dateStr);
        dayCell.setAttribute('title', `${habit} - ${dateStr}`);

        dayCell.addEventListener('click', () => {
          const newState = this.plugin.dataStore.toggleHabit(habit, dateStr);
          if (newState) {
            dayCell.addClass('completed');
            if (habitColor) {
              dayCell.style.backgroundColor = habitColor;
              const num = dayCell.querySelector('.calendar-day-number') as HTMLElement;
              if (num) num.style.color = this.getContrastColor(habitColor);
            }
          } else {
            dayCell.removeClass('completed');
            dayCell.style.backgroundColor = '';
            dayCell.style.outline = '';
            const num = dayCell.querySelector('.calendar-day-number') as HTMLElement;
            if (num) num.style.color = '';
          }
        });
      }
    });
  }

  private renderYearOverview(container: HTMLElement, habitName: string): void {
    const section = container.createEl('div', { cls: 'habit-section year-overview' });

    const header = section.createEl('div', { cls: 'year-overview-header' });

    // Left area: habit name + per-habit navigation (prev / next)
    const headerLeft = header.createEl('div', { cls: 'year-overview-header-left' });
    headerLeft.createEl('div', { text: habitName, cls: 'habit-name' });

    // Add small prev/next arrows between the habit name and the year label so the
    // user can cycle habits while keeping the year overview visible.
    const habitNav = headerLeft.createEl('div', { cls: 'habit-year-nav' });

    const habits = this.plugin.dataStore.getHabits();
    const currentIndex = habits.indexOf(habitName);

    const prevHabitBtn = habitNav.createEl('button', { text: '◀', cls: 'habit-nav-button' });
    prevHabitBtn.disabled = currentIndex <= 0;
    prevHabitBtn.addEventListener('click', async () => {
      if (currentIndex > 0) {
        this.selectedHabit = habits[currentIndex - 1];
        await this.render();
      }
    });

    const nextHabitBtn = habitNav.createEl('button', { text: '▶', cls: 'habit-nav-button' });
    nextHabitBtn.disabled = currentIndex === -1 || currentIndex >= habits.length - 1;
    nextHabitBtn.addEventListener('click', async () => {
      if (currentIndex === -1) return;
      if (currentIndex < habits.length - 1) {
        this.selectedHabit = habits[currentIndex + 1];
        await this.render();
      }
    });

    // Right area: year label
    header.createEl('div', { text: String(this.selectedYear), cls: 'year-overview-year-label' });

    const yearContainer = section.createEl('div', { cls: 'year-overview-container' });

  const yearGrid = yearContainer.createEl('div', { cls: 'year-overview-grid' });

  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth();
    const isCurrentYear = this.selectedYear === currentYear;
  const lastMonth = isCurrentYear ? currentMonth : 11;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayDate = today.getDate();

    // show all 12 months but dim future ones; they can be unlocked individually
    for (let month = 0; month < 12; month++) {
      const monthContainer = yearGrid.createEl('div', { cls: 'year-overview-month' });

      monthContainer.createEl('div', { text: monthNames[month], cls: 'year-overview-month-name' });

      const monthDays = monthContainer.createEl('div', { cls: 'year-overview-days' });

      const daysInMonth = new Date(this.selectedYear, month + 1, 0).getDate();
      const isCurrentMonth = isCurrentYear && month === currentMonth;
      const lastDay = isCurrentMonth ? todayDate : daysInMonth;

      // Compute the weekday the month starts on (0 = Monday, 6 = Sunday)
      const firstOfMonth = new Date(this.selectedYear, month, 1);
      const startingDayOfWeek = (firstOfMonth.getDay() + 6) % 7;

      // Place each day into the month's 7-column grid by computing its weekday and week index
  for (let day = 1; day <= lastDay; day++) {
        const currentDate = new Date(this.selectedYear, month, day);
        const dateStr = this.formatDate(currentDate);
        const dayCell = monthDays.createEl('div', { cls: 'year-overview-day' });
        // compute offset from the first weekday to determine row/column
        const offset = startingDayOfWeek + (day - 1);
        const col = (offset % 7) + 1; // 1-based column (Mon=1)
        const row = Math.floor(offset / 7) + 1; // week index (1-based)
        // place the cell explicitly in the grid so months start on the correct weekday
        dayCell.style.gridColumn = `${col}`;
        dayCell.style.gridRow = `${row}`;
          // Removed the inner span with the day number

        const isCompleted = this.plugin.dataStore.isHabitCompleted(habitName, dateStr);
        const habitColor = this.plugin.dataStore.getHabitColor(habitName);
        if (isCompleted) {
          dayCell.addClass('completed');
          if (habitColor) {
            dayCell.style.backgroundColor = habitColor;
          }
        }

        if (this.isSameDay(currentDate, today)) {
          dayCell.addClass('today');
          if (!isCompleted && habitColor) {
            dayCell.style.backgroundColor = this.hexToRgba(habitColor, 0.12);
            dayCell.style.outline = `2px solid ${this.hexToRgba(habitColor, 0.18)}`;
          }
        }

        dayCell.setAttribute('data-date', dateStr);
        dayCell.setAttribute('title', `${habitName} - ${dateStr}`);

        dayCell.addEventListener('click', () => {
          const newState = this.plugin.dataStore.toggleHabit(habitName, dateStr);
          if (newState) {
            dayCell.addClass('completed');
            if (habitColor) dayCell.style.backgroundColor = habitColor;
          } else {
            dayCell.removeClass('completed');
            dayCell.style.backgroundColor = '';
            dayCell.style.outline = '';
          }
        });
      }
    }

    // After creating months, mark future months as 'upcoming' unless unlocked
    for (let m = 0; m < 12; m++) {
      const mc = yearGrid.children[m] as HTMLElement;
      if (!mc) continue;
      const isFuture = isCurrentYear && m > currentMonth;
      if (isFuture && !this.unlockedMonths.has(m)) {
        mc.addClass('upcoming');
      }
      // make months clickable: unlock that specific month when clicked and select it
      mc.addEventListener('click', async (e) => {
        // if it was upcoming, unlock only this month
        if (isCurrentYear && m > currentMonth) {
          this.unlockedMonths.add(m);
        }
        // set selectedMonth to the clicked month so other views can use it
        this.selectedMonth.setMonth(m);
        this.selectedYear = this.selectedYear;
        await this.render();
      });
    }

    // Year selector removed to maximize vertical space in Year Overview
  }

  private formatDate(date: Date): string {
    return date.toISOString().split('T')[0];
  }

  private hexToRgb(hex: string): { r: number; g: number; b: number } | null {
    // support #rrggbb or #rgb
    const clean = hex.replace('#', '').trim();
    if (clean.length === 3) {
      const r = parseInt(clean[0] + clean[0], 16);
      const g = parseInt(clean[1] + clean[1], 16);
      const b = parseInt(clean[2] + clean[2], 16);
      return { r, g, b };
    }
    if (clean.length === 6) {
      const r = parseInt(clean.slice(0, 2), 16);
      const g = parseInt(clean.slice(2, 4), 16);
      const b = parseInt(clean.slice(4, 6), 16);
      return { r, g, b };
    }
    return null;
  }

  private hexToRgba(hex: string, alpha = 1): string {
    const rgb = this.hexToRgb(hex);
    if (!rgb) return hex;
    return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
  }

  private getContrastColor(hex: string): string {
    const rgb = this.hexToRgb(hex);
    if (!rgb) return '#fff';
    // calculate luminance
    const r = rgb.r / 255;
    const g = rgb.g / 255;
    const b = rgb.b / 255;
    const l = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    return l > 0.6 ? '#000' : '#fff';
  }

  private isSameDay(date1: Date, date2: Date): boolean {
    return date1.getFullYear() === date2.getFullYear() &&
           date1.getMonth() === date2.getMonth() &&
           date1.getDate() === date2.getDate();
  }

  private getEarliestYearWithData(habitName: string): number {
    const currentYear = new Date().getFullYear();
    const habitData = this.plugin.dataStore.getData()[habitName];

    if (!habitData || typeof habitData !== 'object' || Array.isArray(habitData)) {
      return currentYear;
    }

    const dates = Object.keys(habitData as { [date: string]: boolean });
    if (dates.length === 0) {
      return currentYear;
    }

    let earliestYear = currentYear;
    dates.forEach(dateStr => {
      const year = parseInt(dateStr.split('-')[0]);
      if (year < earliestYear) {
        earliestYear = year;
      }
    });

    return earliestYear;
  }

  async onClose(): Promise<void> {
    // Cleanup if needed
  }
}

class AddHabitModal extends Modal {
  plugin: HabitTrackerPlugin;
  onSubmit: () => Promise<void>;

  constructor(app: any, plugin: HabitTrackerPlugin, onSubmit: () => Promise<void>) {
    super(app);
    this.plugin = plugin;
    this.onSubmit = onSubmit;
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();

    contentEl.createEl('h2', { text: 'Add' });

    let habitName = '';
  // default color choices
  const COLORS = ['#0A84FF', '#26A641', '#FF3B30', '#FF9F0A', '#AF52DE', '#5AC8FA', '#FF2D55'];
  let selectedColor = COLORS[0];

    new Setting(contentEl)
      .setName('Habit Name')
      .setDesc('Enter the name of your new habit')
      .addText(text => {
        text.setPlaceholder('e.g., Exercise, Read, Meditate')
          .onChange(value => {
            habitName = value;
          });
        text.inputEl.addEventListener('keypress', (e) => {
          if (e.key === 'Enter') {
            this.submit(habitName);
          }
        });
        setTimeout(() => text.inputEl.focus(), 10);
      });

    // Color picker
    const colorSetting = new Setting(contentEl)
      .setName('Color')
      .setDesc('Pick a color for this habit')
      .addButton(() => {});

    const swatchContainer = contentEl.createEl('div', { cls: 'habit-color-swatches' });
    COLORS.forEach(c => {
      const sw = swatchContainer.createEl('button', { cls: 'color-swatch' });
      sw.setAttr('type', 'button');
      sw.style.backgroundColor = c;
      if (c === selectedColor) sw.addClass('selected');
      sw.addEventListener('click', () => {
        selectedColor = c;
        swatchContainer.querySelectorAll('.color-swatch').forEach((s: Element) => s.classList.remove('selected'));
          sw.classList.add('selected');
      });
    });

    new Setting(contentEl)
      .addButton(btn => btn
        .setButtonText('Add')
        .setCta()
        .onClick(() => {
          this.submit(habitName, selectedColor);
        }))
      .addButton(btn => btn
        .setButtonText('Cancel')
        .onClick(() => {
          this.close();
        }));
  }

  async submit(habitName: string, color?: string): Promise<void> {
    const trimmedName = habitName ? habitName.trim() : '';
    if (!trimmedName) {
      return;
    }

    const success = this.plugin.dataStore.addHabit(trimmedName);
    if (success) {
      if (color) {
        // store color under the trimmed habit name so keys match
        this.plugin.dataStore.setHabitColor(trimmedName, color);
      }
      this.close();
      await this.onSubmit();
    } else {
      const errorEl = this.contentEl.createEl('div', {
        text: 'This habit already exists or the name is invalid!',
        cls: 'habit-error-message'
      });
      setTimeout(() => errorEl.remove(), 3000);
    }
  }

  onClose(): void {
    const { contentEl } = this;
    contentEl.empty();
  }
}

class EditHabitModal extends Modal {
  plugin: HabitTrackerPlugin;
  oldName: string;
  onSubmit: (newName: string) => Promise<void>;

  constructor(app: any, plugin: HabitTrackerPlugin, oldName: string, onSubmit: (newName: string) => Promise<void>) {
    super(app);
    this.plugin = plugin;
    this.oldName = oldName;
    this.onSubmit = onSubmit;
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();

    contentEl.createEl('h2', { text: 'Edit Habit' });

    let habitName = this.oldName;

    new Setting(contentEl)
      .setName('Habit Name')
      .setDesc('Enter the new name for your habit')
      .addText(text => {
        text.setValue(this.oldName)
          .setPlaceholder('e.g., Exercise, Read, Meditate')
          .onChange(value => {
            habitName = value;
          });
        text.inputEl.addEventListener('keypress', (e) => {
          if (e.key === 'Enter') {
            this.submit(habitName);
          }
        });
        setTimeout(() => {
          text.inputEl.focus();
          text.inputEl.select();
        }, 10);
      });

    new Setting(contentEl)
      .addButton(btn => btn
        .setButtonText('Save')
        .setCta()
        .onClick(() => {
          this.submit(habitName);
        }))
      .addButton(btn => btn
        .setButtonText('Cancel')
        .onClick(() => {
          this.close();
        }));
  }

  async submit(habitName: string): Promise<void> {
    if (!habitName.trim() || habitName === this.oldName) {
      this.close();
      return;
    }

    const success = this.plugin.dataStore.renameHabit(this.oldName, habitName);
    if (success) {
      this.close();
      await this.onSubmit(habitName);
    } else {
      const errorEl = this.contentEl.createEl('div', {
        text: 'This habit name already exists or is invalid!',
        cls: 'habit-error-message'
      });
      setTimeout(() => errorEl.remove(), 3000);
    }
  }

  onClose(): void {
    const { contentEl } = this;
    contentEl.empty();
  }
}

class DeleteHabitModal extends Modal {
  plugin: HabitTrackerPlugin;
  habitName: string;
  onSubmit: () => Promise<void>;

  constructor(app: any, plugin: HabitTrackerPlugin, habitName: string, onSubmit: () => Promise<void>) {
    super(app);
    this.plugin = plugin;
    this.habitName = habitName;
    this.onSubmit = onSubmit;
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();

    contentEl.createEl('h2', { text: 'Delete Habit' });

    contentEl.createEl('p', {
      text: `Are you sure you want to delete "${this.habitName}"? This will remove all progress data for this habit.`
    });

    new Setting(contentEl)
      .addButton(btn => btn
        .setButtonText('Delete')
        .setWarning()
        .onClick(async () => {
          this.plugin.dataStore.removeHabit(this.habitName);
          this.close();
          await this.onSubmit();
        }))
      .addButton(btn => btn
        .setButtonText('Cancel')
        .onClick(() => {
          this.close();
        }));
  }

  onClose(): void {
    const { contentEl } = this;
    contentEl.empty();
  }
}
