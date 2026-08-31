(function workoutTracker() {
    "use strict";

    const STORAGE_KEY = "lift-lab-workout-data-v1";
    const CATEGORIES = ["Upper Body", "Lower Body"];
    const EXERCISE_CATALOG = [
        ["exercise-1", "Seated Cable Row", "Upper Body"],
        ["exercise-2", "Tricep Rope Pulldown", "Upper Body"],
        ["exercise-3", "Calf Raise", "Lower Body"],
        ["exercise-4", "Hip Thrust", "Lower Body"],
        ["exercise-5", "Hammer Curls", "Upper Body"],
        ["exercise-6", "Tricep Pushdown", "Upper Body"],
        ["exercise-7", "Hip Abductors", "Lower Body"],
        ["exercise-8", "Concentration Curls", "Upper Body"],
        ["exercise-9", "Lat Pulldown", "Upper Body"],
        ["exercise-10", "Leg Extension", "Lower Body"],
        ["exercise-11", "Leg Curl", "Lower Body"],
        ["exercise-12", "Romanian Deadlift", "Lower Body"]
    ];
    const DEFAULT_SETS = [[20, 12], [20, 12], [20, 12]];
    const CANONICAL_EXERCISE_NAMES = {
        "tricep rope pull down": "Tricep Rope Pulldown",
        "tricep rope pulldown": "Tricep Rope Pulldown",
        "tricep push down": "Tricep Pushdown",
        "tricep pushdown": "Tricep Pushdown",
        "lat pulldown": "Lat Pulldown"
    };
    const EXERCISE_ICON_PATHS = {
        "seated cable row": "Icons/icon_seated_cable_row_icon.svg",
        "tricep rope pulldown": "Icons/icon_tricep_rope_pulldown_icon.svg",
        "calf raise": "Icons/icon_calf_raise_icon.svg",
        "hip thrust": "Icons/icon_hip_thrust_icon.svg",
        "hammer curls": "Icons/icon_hammer_curls_icon.svg",
        "tricep pushdown": "Icons/icon_tricep_push_down_icon.svg",
        "hip abductors": "Icons/icon_hip_abductors_icon.svg",
        "concentration curls": "Icons/icon_concentration_curls_icon.svg",
        "lat pulldown": "Icons/icon_lat_pulldown_icon.svg",
        "leg extension": "Icons/icon_leg_extension.svg",
        "leg curl": "Icons/icon_leg_curl_icon.svg",
        "romanian deadlift": "Icons/icon_romanian_deadlift_icon.svg"
    };
    const todayView = document.getElementById("today-view");
    const progressView = document.getElementById("progress-view");
    const calendarView = document.getElementById("calendar-view");
    const dialog = document.getElementById("app-dialog");
    const toast = document.getElementById("toast");
    let toastTimer;
    let storageAvailable = true;

    const state = {
        data: loadData(),
        view: "today",
        selectedDate: dateKey(new Date()),
        routine: "Upper Body",
        expandedExerciseId: null,
        progressExerciseId: null,
        progressRoutine: "Upper Body",
        progressMetric: "weight",
        progressSearch: "",
        calendarMonth: `${dateKey(new Date()).slice(0, 7)}-01`
    };

    renderAll();

    document.addEventListener("click", handleClick);
    document.addEventListener("input", handleInput);
    document.addEventListener("change", handleChange);
    document.addEventListener("submit", handleSubmit);
    dialog.addEventListener("click", (event) => {
        if (event.target === dialog) dialog.close();
    });

    function initialData() {
        return {
            version: 1,
            exercises: EXERCISE_CATALOG.map(([id, name, category]) => ({ id, name, category })),
            sets: [],
            bodyWeights: {}
        };
    }

    function loadData() {
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved) {
                const parsed = JSON.parse(saved);
                if (isValidData(parsed)) {
                    if (migrateExerciseData(parsed)) {
                        localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
                    }
                    return parsed;
                }
            }

            const data = initialData();
            localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
            return data;
        } catch (error) {
            storageAvailable = false;
            return initialData();
        }
    }

    function isValidData(value) {
        return Boolean(
            value
            && Array.isArray(value.exercises)
            && Array.isArray(value.sets)
            && value.bodyWeights
            && typeof value.bodyWeights === "object"
        );
    }

    function migrateExerciseData(data) {
        let changed = false;
        const removedIds = new Set(
            data.exercises
                .filter((exercise) => exercise.name.toLowerCase() === "glute machine")
                .map((exercise) => exercise.id)
        );
        if (removedIds.size) {
            data.exercises = data.exercises.filter((exercise) => !removedIds.has(exercise.id));
            data.sets = data.sets.filter((set) => !removedIds.has(set.exerciseId));
            changed = true;
        }
        data.exercises.forEach((exercise) => {
            const canonicalName = CANONICAL_EXERCISE_NAMES[exercise.name.toLowerCase()];
            if (canonicalName && exercise.name !== canonicalName) {
                exercise.name = canonicalName;
                changed = true;
            }
        });
        return changed;
    }

    function persist() {
        if (!storageAvailable) return false;

        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(state.data));
            return true;
        } catch (error) {
            storageAvailable = false;
            showToast("This browser blocked local saving.");
            return false;
        }
    }

    function renderAll() {
        renderNavigation();
        renderToday();
        renderProgress();
        renderCalendar();
    }

    function renderNavigation() {
        document.querySelectorAll("[data-view]").forEach((button) => {
            button.classList.toggle("is-active", button.dataset.view === state.view);
        });
        todayView.hidden = state.view !== "today";
        progressView.hidden = state.view !== "progress";
        calendarView.hidden = state.view !== "calendar";
    }

    function renderToday() {
        const selectedSets = setsOnDay(state.selectedDate);
        const routineExercises = state.data.exercises
            .filter((exercise) => exercise.category === state.routine)
            .sort((a, b) => a.name.localeCompare(b.name));
        const weightValue = state.data.bodyWeights[state.selectedDate];
        const bodyWeightPoints = Object.entries(state.data.bodyWeights)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([, weight]) => Number(weight));
        const weightTrend = bodyWeightTrend(state.selectedDate);

        todayView.innerHTML = `
            <div class="workspace-grid">
                <section class="panel workout-panel" aria-label="Workout session">
                    <div class="panel-heading">
                        ${selectedSets.length ? `<h2>Session in motion</h2>` : ""}
                        <div class="date-control">
                            <button class="date-arrow" type="button" data-action="shift-date" data-days="-1" aria-label="Previous day">
                                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m14 6-6 6 6 6"/></svg>
                            </button>
                            <label class="date-input-wrap">
                                <span hidden>Workout date</span>
                                <input class="date-input" id="workout-date" type="date" value="${state.selectedDate}" aria-label="Workout date">
                            </label>
                            <button class="date-arrow" type="button" data-action="shift-date" data-days="1" aria-label="Next day">
                                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m10 6 6 6-6 6"/></svg>
                            </button>
                        </div>
                    </div>

                    <div class="routine-tabs" role="tablist" aria-label="Routine">
                        ${CATEGORIES.map((category) => `
                            <button type="button" class="routine-tab ${state.routine === category ? "is-active" : ""}"
                                data-routine="${category}" role="tab" aria-selected="${state.routine === category}">${category}</button>
                        `).join("")}
                    </div>

                    <div class="exercise-list">
                        ${routineExercises.map(renderExerciseCard).join("")}
                    </div>
                    <button class="add-exercise-button" type="button" data-action="new-exercise">
                        <span aria-hidden="true">＋</span> Add a new exercise
                    </button>
                </section>

                <aside class="sidebar" aria-label="Body weight">
                    <section class="side-card weight-card">
                        <div class="weight-card-header">
                            <p class="eyebrow">Body weight</p>
                            <h2>${escapeHTML(shortDate(state.selectedDate))}</h2>
                        </div>
                        <label class="body-weight-control">
                            <span hidden>Body weight in kilograms</span>
                            <input class="body-weight-input" id="body-weight" type="number" min="0" max="400" step="0.01"
                                value="${weightValue ?? ""}" placeholder="Add" inputmode="decimal">
                            <span class="body-weight-unit">kg</span>
                        </label>
                        <div class="weight-card-trend">
                            ${sparkline(bodyWeightPoints, 270, 56, 3, "Body weight trend")}
                            <p class="panel-copy">${escapeHTML(weightTrend)}</p>
                        </div>
                    </section>
                </aside>
            </div>
        `;
    }

    function renderExerciseCard(exercise) {
        const currentSets = setsForExercise(exercise.id, state.selectedDate);
        const allSets = setsForExercise(exercise.id);
        const best = heaviestSet(allSets);
        const isOpen = state.expandedExerciseId === exercise.id;
        const historyLabel = best ? `PB ${formatNumber(best.weight)} kg × ${best.reps}` : "No history yet";

        return `
            <article class="exercise-card ${isOpen ? "is-open" : ""} ${currentSets.length ? "is-started" : ""}">
                <div class="exercise-card-header">
                    <button type="button" class="exercise-toggle" data-action="toggle-exercise" data-exercise-id="${escapeAttribute(exercise.id)}"
                        aria-expanded="${isOpen}">
                        <span class="exercise-icon exercise-icon-workout" aria-hidden="true">${exerciseIconMarkup(exercise)}</span>
                        <span class="exercise-title-wrap">
                            <span class="exercise-title">${escapeHTML(exercise.name)}</span>
                            ${currentSets.length ? `
                                <span class="exercise-meta">
                                    <span>${allSets.length} lifetime sets</span>
                                    <span class="history-pb">${escapeHTML(historyLabel)}</span>
                                </span>
                            ` : ""}
                        </span>
                        <svg class="exercise-chevron" viewBox="0 0 24 24" aria-hidden="true"><path d="m9 5 7 7-7 7"/></svg>
                    </button>
                    ${currentSets.length
                        ? `<span class="today-count">${currentSets.length} set${currentSets.length === 1 ? "" : "s"}</span>`
                        : `<button type="button" class="plus-button" data-action="start-session" data-exercise-id="${escapeAttribute(exercise.id)}"
                            aria-label="Start ${escapeAttribute(exercise.name)}" title="Start ${escapeAttribute(exercise.name)}">
                            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>
                        </button>`}
                </div>
                ${isOpen ? renderExpandedSets(exercise, currentSets) : ""}
            </article>
        `;
    }

    function renderExpandedSets(exercise, currentSets) {
        if (!currentSets.length) {
            return `
                <div class="exercise-expanded">
                    <div class="empty-sets">No sets on this day yet.<br>Your most recent set plan is one tap away.</div>
                    <div class="expanded-actions">
                        <button type="button" class="small-button" data-action="start-session" data-exercise-id="${escapeAttribute(exercise.id)}">Reuse last session</button>
                    </div>
                </div>
            `;
        }

        const priorSets = setsForExercise(exercise.id).filter((set) => set.date.slice(0, 10) < state.selectedDate);
        const priorWeight = priorSets.length ? Math.max(...priorSets.map((set) => set.weight)) : 0;
        const priorOneRepMax = priorSets.length ? Math.max(...priorSets.map(estimatedOneRepMax)) : 0;
        const best = heaviestSet(setsForExercise(exercise.id));

        return `
            <div class="exercise-expanded">
                <div class="set-table-head" aria-hidden="true">
                    <span>Set</span><span>Weight</span><span>Reps</span><span class="estimate-heading">Est. 1RM</span><span></span>
                </div>
                ${currentSets.map((set, index) => {
                    const isPB = priorSets.length > 0 && set.weight > 0
                        && (set.weight > priorWeight || estimatedOneRepMax(set) > priorOneRepMax);
                    return `
                        <div class="set-row">
                            <span class="set-index">${index + 1}${isPB ? `<span class="pb-badge" title="New personal best" aria-label="New personal best">★</span>` : ""}</span>
                            <label class="set-field-wrap">
                                <span hidden>Weight for set ${index + 1}</span>
                                <input class="set-field" type="number" min="0" max="1000" step="0.5" inputmode="decimal"
                                    data-set-field="weight" data-set-id="${escapeAttribute(set.id)}" value="${set.weight}">
                                <span class="set-unit">kg</span>
                            </label>
                            <label class="set-field-wrap">
                                <span hidden>Repetitions for set ${index + 1}</span>
                                <input class="set-field" type="number" min="0" max="999" step="1" inputmode="numeric"
                                    data-set-field="reps" data-set-id="${escapeAttribute(set.id)}" value="${set.reps}">
                                <span class="set-unit">×</span>
                            </label>
                            <span class="set-estimate">${formatNumber(estimatedOneRepMax(set))} <span>kg</span></span>
                            <button class="set-delete" type="button" data-action="delete-set" data-set-id="${escapeAttribute(set.id)}" aria-label="Delete set ${index + 1}">
                                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16m-10 4v6m4-6v6M9 7l1-3h4l1 3m-9 0 1 14h10l1-14"/></svg>
                            </button>
                        </div>
                    `;
                }).join("")}
                <div class="expanded-actions">
                    <button type="button" class="small-button" data-action="add-set" data-exercise-id="${escapeAttribute(exercise.id)}">＋ Add set</button>
                    ${best ? `<span class="pb-copy">All-time PB · ${formatNumber(best.weight)} kg × ${best.reps}</span>` : ""}
                    <button type="button" class="small-button danger" data-action="clear-sets" data-exercise-id="${escapeAttribute(exercise.id)}">Clear day</button>
                </div>
            </div>
        `;
    }

    function renderProgress() {
        const trained = state.data.exercises
            .filter((exercise) => exercise.category === state.progressRoutine)
            .filter((exercise) => setsForExercise(exercise.id).length > 0)
            .filter((exercise) => exercise.name.toLowerCase().includes(state.progressSearch.toLowerCase()))
            .sort((a, b) => a.name.localeCompare(b.name));

        if (!trained.some((exercise) => exercise.id === state.progressExerciseId)) {
            state.progressExerciseId = trained[0]?.id ?? null;
        }
        const selected = trained.find((exercise) => exercise.id === state.progressExerciseId);

        progressView.innerHTML = `
            <div class="progress-layout">
                <section class="panel progress-section" aria-label="Progress details">
                    <div class="progress-controls">
                        <div class="routine-tabs progress-routine-tabs" role="tablist" aria-label="Progress routine">
                            ${CATEGORIES.map((category) => `
                                <button type="button" class="routine-tab ${state.progressRoutine === category ? "is-active" : ""}"
                                    data-progress-routine="${category}" role="tab" aria-selected="${state.progressRoutine === category}">${category}</button>
                            `).join("")}
                        </div>
                        <label class="search-wrap">
                            <span hidden>Search ${state.progressRoutine.toLowerCase()} exercises</span>
                            <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m16 16 4 4"/></svg>
                            <input id="progress-search" class="search-input" type="search" placeholder="Find an exercise" value="${escapeAttribute(state.progressSearch)}">
                        </label>
                    </div>
                    ${trained.length ? `
                        <div class="progress-browser">
                            <div class="progress-list">
                                ${trained.map(renderProgressExercise).join("")}
                            </div>
                        </div>
                        ${renderProgressDetail(selected)}
                    ` : `<div class="progress-empty">${state.progressSearch ? "No exercises match your search in this routine." : `Log some ${state.progressRoutine.toLowerCase()} sets and your progress will show up here.`}</div>`}
                </section>
            </div>
        `;
    }

    function renderProgressExercise(exercise) {
        return `
            <button type="button" class="progress-exercise ${state.progressExerciseId === exercise.id ? "is-active" : ""}"
                data-action="select-progress" data-exercise-id="${escapeAttribute(exercise.id)}">
                <span class="exercise-icon exercise-icon-progress" aria-hidden="true">${exerciseIconMarkup(exercise)}</span>
                <span>${escapeHTML(exercise.name)}</span>
            </button>
        `;
    }

    function exerciseIconMarkup(exercise) {
        const path = EXERCISE_ICON_PATHS[exercise.name.toLowerCase()];
        if (path) return `<img src="${escapeAttribute(path)}?v=3" alt="" draggable="false">`;
        return `<svg viewBox="0 0 24 24"><path d="M6 8v8M3 10v4m15-6v8m3-6v4M6 12h12"/></svg>`;
    }

    function renderProgressDetail(exercise) {
        const allSets = setsForExercise(exercise.id);
        const heaviest = heaviestSet(allSets);
        const strongest = [...allSets].sort((a, b) => estimatedOneRepMax(b) - estimatedOneRepMax(a))[0];
        const points = bestPerDay(exercise.id, state.progressMetric);
        const axisMax = progressAxisMax(state.progressMetric);
        const sessions = sessionsForExercise(exercise.id).slice(0, 3);
        const bestReps = Math.max(...allSets.map((set) => set.reps));

        return `
            <div class="progress-card" aria-labelledby="progress-detail-title">
                <div class="progress-card-header">
                    <div>
                        <h2 id="progress-detail-title">${escapeHTML(exercise.name)}</h2>
                    </div>
                </div>

                <div class="pb-grid">
                    <div class="pb-stat">
                        <span>Best set</span>
                        <strong>${formatNumber(strongest.weight)} × ${strongest.reps}</strong>
                        <small>${formatNumber(estimatedOneRepMax(strongest))} kg est. 1RM</small>
                    </div>
                    <div class="pb-stat">
                        <span>Top weight</span>
                        <strong>${formatNumber(heaviest.weight)} kg</strong>
                        <small>${heaviest.reps} reps</small>
                    </div>
                    <div class="pb-stat">
                        <span>Most reps</span>
                        <strong>${bestReps}</strong>
                        <small>in one set</small>
                    </div>
                </div>

                <div class="chart-shell">
                    ${progressChart(points, state.progressMetric === "weight" ? "Top weight" : "Estimated one-rep max", axisMax)}
                </div>
                <div class="metric-tabs" role="tablist" aria-label="Chart metric">
                    <button type="button" class="metric-tab ${state.progressMetric === "weight" ? "is-active" : ""}" data-metric="weight">Top weight</button>
                    <button type="button" class="metric-tab ${state.progressMetric === "oneRepMax" ? "is-active" : ""}" data-metric="oneRepMax">Est. 1RM</button>
                </div>

                <h3 class="history-title">Recent sessions</h3>
                <div>
                    ${sessions.map((session) => {
                        const top = heaviestSet(session.sets);
                        return `
                            <div class="history-row">
                                <span class="history-date">${escapeHTML(shortDate(session.day))}</span>
                                <span class="history-sets">${session.sets.map((set) => `${formatNumber(set.weight)}×${set.reps}`).join(" · ")}</span>
                                <span class="history-top">Top ${formatNumber(top.weight)} kg</span>
                            </div>
                        `;
                    }).join("")}
                </div>
            </div>
        `;
    }

    function renderCalendar() {
        const monthDate = dateFromKey(state.calendarMonth);
        const year = monthDate.getFullYear();
        const month = monthDate.getMonth();
        const monthPrefix = state.calendarMonth.slice(0, 7);
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const leadingDays = (monthDate.getDay() + 6) % 7;
        const trainedDays = new Set(state.data.sets.map((set) => set.date.slice(0, 10)));
        const trainingDaysThisMonth = [...trainedDays].filter((day) => day.startsWith(monthPrefix)).length;
        const monthLabel = monthDate.toLocaleDateString(undefined, { month: "long", year: "numeric" });
        const today = dateKey(new Date());
        const weekdays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

        calendarView.innerHTML = `
            <div class="calendar-wrap">
                <section class="calendar-card" aria-labelledby="calendar-month-label">
                    <div class="calendar-toolbar">
                        <button type="button" class="calendar-arrow" data-action="shift-month" data-months="-1" aria-label="Previous month">
                            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 18-6-6 6-6"/></svg>
                        </button>
                        <div>
                            <span class="calendar-summary">${trainingDaysThisMonth} training day${trainingDaysThisMonth === 1 ? "" : "s"}</span>
                            <h2 id="calendar-month-label">${escapeHTML(monthLabel)}</h2>
                        </div>
                        <button type="button" class="calendar-arrow" data-action="shift-month" data-months="1" aria-label="Next month">
                            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg>
                        </button>
                    </div>
                    <div class="calendar-grid" role="grid" aria-label="${escapeAttribute(monthLabel)} training calendar">
                        ${weekdays.map((weekday) => `<span class="calendar-weekday" role="columnheader">${weekday}</span>`).join("")}
                        ${Array.from({ length: leadingDays }, () => `<span class="calendar-empty" aria-hidden="true"></span>`).join("")}
                        ${Array.from({ length: daysInMonth }, (_, index) => {
                            const dayNumber = index + 1;
                            const dayKey = `${monthPrefix}-${String(dayNumber).padStart(2, "0")}`;
                            const trained = trainedDays.has(dayKey);
                            const fullDate = dateFromKey(dayKey).toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long", year: "numeric" });
                            return `
                                <span class="calendar-day ${trained ? "is-trained" : ""} ${dayKey === today ? "is-today" : ""}"
                                    role="gridcell" aria-label="${escapeAttribute(fullDate)}, ${trained ? "trained" : "no training recorded"}">
                                    <span class="calendar-date">${dayNumber}</span>
                                    ${trained ? `<span class="calendar-tick" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="m6 12 4 4 8-9"/></svg></span>` : ""}
                                </span>
                            `;
                        }).join("")}
                    </div>
                    <div class="calendar-footer">
                        <span><i class="calendar-legend-tick" aria-hidden="true">✓</i> Trained</span>
                        <button type="button" class="calendar-today" data-action="current-month">This month</button>
                    </div>
                </section>
            </div>
        `;
    }

    function handleClick(event) {
        const chartPoint = event.target.closest("[data-chart-point]");
        document.querySelectorAll(".chart-point.is-active").forEach((point) => {
            if (point !== chartPoint) point.classList.remove("is-active");
        });
        if (chartPoint) {
            chartPoint.classList.toggle("is-active");
            return;
        }

        const viewButton = event.target.closest("[data-view]");
        if (viewButton) {
            state.view = viewButton.dataset.view;
            renderNavigation();
            if (state.view === "progress") renderProgress();
            if (state.view === "calendar") renderCalendar();
            window.scrollTo({ top: 0, behavior: "smooth" });
            return;
        }

        const routineButton = event.target.closest("[data-routine]");
        if (routineButton) {
            state.routine = routineButton.dataset.routine;
            state.expandedExerciseId = null;
            renderToday();
            return;
        }

        const progressRoutineButton = event.target.closest("[data-progress-routine]");
        if (progressRoutineButton) {
            state.progressRoutine = progressRoutineButton.dataset.progressRoutine;
            state.progressExerciseId = null;
            renderProgress();
            return;
        }

        const metricButton = event.target.closest("[data-metric]");
        if (metricButton) {
            state.progressMetric = metricButton.dataset.metric;
            renderProgress();
            return;
        }

        const actionButton = event.target.closest("[data-action]");
        if (!actionButton) return;

        const { action, exerciseId, setId } = actionButton.dataset;
        switch (action) {
        case "toggle-exercise":
            state.expandedExerciseId = state.expandedExerciseId === exerciseId ? null : exerciseId;
            renderToday();
            break;
        case "start-session":
            startSession(exerciseId);
            break;
        case "add-set":
            addSet(exerciseId);
            break;
        case "delete-set":
            state.data.sets = state.data.sets.filter((set) => set.id !== setId);
            persist();
            renderToday();
            break;
        case "clear-sets":
            clearSets(exerciseId);
            break;
        case "shift-date":
            state.selectedDate = shiftDate(state.selectedDate, Number(actionButton.dataset.days));
            state.expandedExerciseId = null;
            renderToday();
            break;
        case "new-exercise":
            showNewExerciseDialog();
            break;
        case "select-progress":
            state.progressExerciseId = exerciseId;
            renderProgress();
            break;
        case "shift-month":
            state.calendarMonth = shiftMonth(state.calendarMonth, Number(actionButton.dataset.months));
            renderCalendar();
            break;
        case "current-month":
            state.calendarMonth = `${dateKey(new Date()).slice(0, 7)}-01`;
            renderCalendar();
            break;
        case "close-dialog":
            dialog.close();
            break;
        default:
            break;
        }
    }

    function handleInput(event) {
        const target = event.target;
        if (target.matches("[data-set-field]")) {
            const set = state.data.sets.find((item) => item.id === target.dataset.setId);
            if (!set) return;
            const value = Number(target.value);
            if (target.dataset.setField === "reps") {
                set.reps = Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0;
            } else {
                set.weight = Number.isFinite(value) ? Math.max(0, value) : 0;
            }
            const estimate = target.closest(".set-row")?.querySelector(".set-estimate");
            if (estimate) estimate.innerHTML = `${formatNumber(estimatedOneRepMax(set))} <span>kg</span>`;
            persist();
            return;
        }

        if (target.id === "body-weight") {
            if (target.value === "") {
                delete state.data.bodyWeights[state.selectedDate];
            } else {
                const value = Number(target.value);
                if (Number.isFinite(value)) state.data.bodyWeights[state.selectedDate] = Math.max(0, value);
            }
            persist();
            return;
        }

        if (target.id === "progress-search") {
            state.progressSearch = target.value;
            renderProgress();
            const replacement = document.getElementById("progress-search");
            replacement.focus();
            replacement.setSelectionRange(replacement.value.length, replacement.value.length);
        }
    }

    function handleChange(event) {
        if (event.target.id === "workout-date") {
            state.selectedDate = event.target.value || dateKey(new Date());
            state.expandedExerciseId = null;
            renderToday();
        }
    }

    function handleSubmit(event) {
        if (event.target.id !== "new-exercise-form") return;
        event.preventDefault();
        const form = new FormData(event.target);
        const name = String(form.get("name") || "").trim();
        const category = String(form.get("category") || state.routine);
        if (!name || !CATEGORIES.includes(category)) return;

        const duplicate = state.data.exercises.some((exercise) => exercise.name.toLowerCase() === name.toLowerCase());
        if (duplicate) {
            showToast("That exercise already exists.");
            return;
        }

        const exercise = {
            id: uniqueId("exercise"),
            name,
            category,
            createdAt: new Date().toISOString()
        };
        state.data.exercises.push(exercise);
        state.routine = category;
        state.expandedExerciseId = exercise.id;
        persist();
        dialog.close();
        renderToday();
        showToast(`${name} added to ${category}.`);
    }

    function startSession(exerciseId) {
        if (setsForExercise(exerciseId, state.selectedDate).length) return;
        const previousSessions = sessionsForExercise(exerciseId)
            .filter((session) => session.day < state.selectedDate)
            .sort((a, b) => b.day.localeCompare(a.day));
        const template = previousSessions[0]?.sets.map((set) => [set.weight, set.reps]) ?? DEFAULT_SETS;
        template.forEach(([weight, reps], index) => {
            state.data.sets.push(makeSet(exerciseId, weight, reps, index));
        });
        state.expandedExerciseId = exerciseId;
        persist();
        renderToday();
        showToast(previousSessions.length ? "Last session copied — adjust anything you need." : "Three starter sets added.");
    }

    function addSet(exerciseId) {
        const current = setsForExercise(exerciseId, state.selectedDate);
        const recent = current.at(-1)
            ?? setsForExercise(exerciseId).filter((set) => set.date.slice(0, 10) < state.selectedDate).at(-1);
        state.data.sets.push(makeSet(exerciseId, recent?.weight ?? 20, recent?.reps ?? 12, current.length));
        persist();
        renderToday();
    }

    function clearSets(exerciseId) {
        const exercise = state.data.exercises.find((item) => item.id === exerciseId);
        if (!window.confirm(`Clear all ${exercise?.name ?? "exercise"} sets for ${shortDate(state.selectedDate)}?`)) return;
        state.data.sets = state.data.sets.filter((set) => !(set.exerciseId === exerciseId && set.date.startsWith(state.selectedDate)));
        persist();
        renderToday();
    }

    function makeSet(exerciseId, weight, reps, index) {
        return {
            id: uniqueId("set"),
            exerciseId,
            date: `${state.selectedDate}T12:00:00.${String(Math.min(index, 999)).padStart(3, "0")}`,
            weight,
            reps
        };
    }

    function showNewExerciseDialog() {
        dialog.innerHTML = `
            <form class="dialog-content" id="new-exercise-form">
                <div class="dialog-header">
                    <div><p class="eyebrow">Build your routine</p><h2 id="dialog-title">New exercise</h2><p class="panel-copy">Add it once and it stays in your list.</p></div>
                    <button type="button" class="dialog-close" data-action="close-dialog" aria-label="Close">×</button>
                </div>
                <div class="form-group">
                    <label for="exercise-name">Exercise name</label>
                    <input class="form-input" id="exercise-name" name="name" type="text" maxlength="80" placeholder="e.g. Goblet Squat" required autocomplete="off">
                </div>
                <div class="form-group">
                    <label for="exercise-category">Routine</label>
                    <select class="form-select" id="exercise-category" name="category">
                        ${CATEGORIES.map((category) => `<option ${category === state.routine ? "selected" : ""}>${category}</option>`).join("")}
                    </select>
                </div>
                <div class="dialog-actions">
                    <button type="button" class="ghost-button" data-action="close-dialog">Cancel</button>
                    <button type="submit" class="primary-button">Add exercise</button>
                </div>
            </form>
        `;
        dialog.showModal();
        document.getElementById("exercise-name").focus();
    }

    function setsOnDay(day) {
        return state.data.sets.filter((set) => set.date.startsWith(day));
    }

    function setsForExercise(exerciseId, day) {
        return state.data.sets
            .filter((set) => set.exerciseId === exerciseId && (!day || set.date.startsWith(day)))
            .sort((a, b) => a.date.localeCompare(b.date));
    }

    function sessionsForExercise(exerciseId) {
        const grouped = new Map();
        setsForExercise(exerciseId).forEach((set) => {
            const day = set.date.slice(0, 10);
            if (!grouped.has(day)) grouped.set(day, []);
            grouped.get(day).push(set);
        });
        return [...grouped.entries()]
            .map(([day, sets]) => ({ day, sets }))
            .sort((a, b) => b.day.localeCompare(a.day));
    }

    function bestPerDay(exerciseId, metric) {
        return sessionsForExercise(exerciseId)
            .map((session) => ({
                date: session.day,
                value: Math.max(...session.sets.map((set) => metric === "oneRepMax" ? estimatedOneRepMax(set) : set.weight))
            }))
            .sort((a, b) => a.date.localeCompare(b.date));
    }

    function heaviestSet(sets) {
        return [...sets].sort((a, b) => b.weight - a.weight || b.reps - a.reps)[0] ?? null;
    }

    function estimatedOneRepMax(set) {
        return set.reps > 0 ? set.weight * (1 + set.reps / 30) : 0;
    }

    function progressAxisMax(metric) {
        const highestValue = Math.max(
            1,
            ...state.data.sets.map((set) => metric === "oneRepMax" ? estimatedOneRepMax(set) : set.weight)
        );
        const roughStep = highestValue / 4;
        const magnitude = 10 ** Math.floor(Math.log10(roughStep));
        const normalisedStep = roughStep / magnitude;
        const stepMultiplier = normalisedStep <= 1 ? 1 : normalisedStep <= 2 ? 2 : normalisedStep <= 5 ? 5 : 10;
        return stepMultiplier * magnitude * 4;
    }

    function bodyWeightTrend(day) {
        const entries = Object.entries(state.data.bodyWeights)
            .filter(([entryDay]) => entryDay <= day)
            .sort(([a], [b]) => a.localeCompare(b));
        if (!entries.length) return "Add a measurement — it saves as you type.";
        const current = state.data.bodyWeights[day];
        const previousEntries = entries.filter(([entryDay]) => entryDay < day);
        if (current == null || !previousEntries.length) return `${entries.length} saved measurement${entries.length === 1 ? "" : "s"} in your history.`;
        const previous = Number(previousEntries.at(-1)[1]);
        const difference = Number(current) - previous;
        if (Math.abs(difference) < 0.005) return "Holding steady since your last measurement.";
        return `${difference > 0 ? "+" : ""}${formatNumber(difference)} kg since your last measurement.`;
    }

    function progressChart(points, label, axisMax) {
        if (points.length < 2) {
            return `<div class="chart-empty">Log this exercise on at least two different days to see a trend.</div>`;
        }

        const width = 680;
        const height = 270;
        const margin = { top: 20, right: 18, bottom: 36, left: 48 };
        const min = 0;
        const max = axisMax;
        const innerWidth = width - margin.left - margin.right;
        const innerHeight = height - margin.top - margin.bottom;
        const x = (index) => margin.left + (index / (points.length - 1)) * innerWidth;
        const y = (value) => margin.top + ((max - value) / (max - min)) * innerHeight;
        const coordinates = points.map((point, index) => [x(index), y(point.value)]);
        const line = coordinates.map(([px, py], index) => `${index ? "L" : "M"}${px.toFixed(1)},${py.toFixed(1)}`).join(" ");
        const baseline = margin.top + innerHeight;
        const area = `${line} L${coordinates.at(-1)[0].toFixed(1)},${baseline} L${coordinates[0][0].toFixed(1)},${baseline} Z`;
        const grid = [0, 1, 2, 3, 4].map((index) => {
            const ratio = index / 4;
            const gridY = margin.top + ratio * innerHeight;
            const value = max - ratio * (max - min);
            const axisLabel = new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 }).format(value);
            return `<line class="chart-grid-line" x1="${margin.left}" x2="${width - margin.right}" y1="${gridY}" y2="${gridY}"/>
                <text class="chart-label" x="${margin.left - 8}" y="${gridY + 3}" text-anchor="end">${axisLabel}</text>`;
        }).join("");
        const labelIndexes = [...new Set([0, Math.floor((points.length - 1) / 2), points.length - 1])];
        const chartPoints = coordinates.map(([px, py], index) => {
            const point = points[index];
            const date = shortDate(point.date);
            const value = `${formatNumber(point.value)} kg`;
            const tooltipWidth = 140;
            const tooltipX = Math.min(width - margin.right - tooltipWidth, Math.max(margin.left, px - tooltipWidth / 2));
            const tooltipY = py < 64 ? py + 14 : py - 54;
            return `
                <g class="chart-point" data-chart-point tabindex="0" aria-label="${escapeAttribute(`${date}: ${value}`)}">
                    <circle class="chart-hit" cx="${px}" cy="${py}" r="20"/>
                    <circle class="chart-dot" cx="${px}" cy="${py}" r="5"/>
                    <g class="chart-tooltip" transform="translate(${tooltipX.toFixed(1)} ${tooltipY.toFixed(1)})" aria-hidden="true">
                        <rect class="chart-tooltip-panel" width="${tooltipWidth}" height="40" rx="10"/>
                        <text class="chart-tooltip-date" x="10" y="16">${escapeHTML(date)}</text>
                        <text class="chart-tooltip-value" x="10" y="31">${escapeHTML(value)}</text>
                    </g>
                </g>`;
        }).join("");

        return `
            <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeAttribute(label)} progress chart from ${shortDate(points[0].date)} to ${shortDate(points.at(-1).date)}">
                <defs><linearGradient id="chart-gradient" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#6655d0" stop-opacity=".24"/><stop offset="1" stop-color="#6655d0" stop-opacity="0"/></linearGradient></defs>
                ${grid}
                <path class="chart-area" d="${area}"/>
                <path class="chart-line" d="${line}"/>
                ${chartPoints}
                ${labelIndexes.map((index) => `<text class="chart-label" x="${x(index)}" y="${height - 8}" text-anchor="${index === 0 ? "start" : index === points.length - 1 ? "end" : "middle"}">${shortDate(points[index].date)}</text>`).join("")}
            </svg>
        `;
    }

    function sparkline(values, width, height, padding, label) {
        if (!values.length) return `<svg class="sparkline" viewBox="0 0 ${width} ${height}" role="img" aria-label="No ${escapeAttribute(label)} data"></svg>`;
        const min = Math.min(...values);
        const max = Math.max(...values);
        const range = max - min || 1;
        const points = values.map((value, index) => {
            const x = values.length === 1 ? width / 2 : padding + (index / (values.length - 1)) * (width - padding * 2);
            const y = padding + ((max - value) / range) * (height - padding * 2);
            return [x, y];
        });
        const path = points.map(([x, y], index) => `${index ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
        return `<svg class="sparkline" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeAttribute(label)}"><path d="${path}"/></svg>`;
    }

    function dateKey(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const day = String(date.getDate()).padStart(2, "0");
        return `${year}-${month}-${day}`;
    }

    function dateFromKey(key) {
        return new Date(`${key}T12:00:00`);
    }

    function shiftDate(key, days) {
        const date = dateFromKey(key);
        date.setDate(date.getDate() + days);
        return dateKey(date);
    }

    function shiftMonth(key, months) {
        const date = dateFromKey(key);
        date.setMonth(date.getMonth() + months);
        return `${dateKey(date).slice(0, 7)}-01`;
    }

    function shortDate(key) {
        return dateFromKey(key).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
    }

    function formatNumber(value) {
        return new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(Number(value) || 0);
    }

    function uniqueId(prefix) {
        const random = window.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
        return `${prefix}-${random}`;
    }

    function escapeHTML(value) {
        return String(value).replace(/[&<>'"]/g, (character) => ({
            "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", "\"": "&quot;"
        })[character]);
    }

    function escapeAttribute(value) {
        return escapeHTML(value);
    }

    function showToast(message) {
        toast.textContent = message;
        toast.classList.add("is-visible");
        window.clearTimeout(toastTimer);
        toastTimer = window.setTimeout(() => toast.classList.remove("is-visible"), 2800);
    }
}());
