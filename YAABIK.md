# Ваш личный Яабик

Первый интерактивный вариант: пятая вкладка навигации по центру, стартовым экраном остаётся Студия. Экран загружается отдельным чанком при открытии.

Бесплатный Яабик-01: пиксельный CRT-робот, моргание, спокойная анимация, реакции на касание, приветствие, игру и отдых. Три расцветки корпуса и три режима комнаты, включая оформление под текущую тему. Нет голода, штрафов, экономики, бонусов и платных открытий.

Выбор корпуса и комнаты сохраняется в localStorage отдельно для ID пользователя. Серверной коллекции и синхронизации между устройствами пока нет. В коллекции показан стартовый робот и закрытое место для будущих моделей.

Анимации используют CSS/SVG, при скрытии вкладки приостанавливаются. Системное уменьшение движения соблюдается. Проверены касание, выбор корпуса, сохранение после перезагрузки и ширина 316 CSS px без горизонтального скролла.

Локальный стенд: http://127.0.0.1:5187/studio-preview.html?scene=yaabik
Прямая ссылка экрана: ?ref=studio_yaabik

Обновлённый корпус: единый компактный плеер с утопленным экраном, вентиляцией, USB и маленькими ладошками. Материалы корпуса и лица выбираются текущей темой приложения; выбор отделки меняет только акценты. Для Nyan добавлены ушки, для Тетриса цветные кнопки, для Какашечек кафельный узор, для Неона подсветка линий. Приветствие машет рукой, игра запускает три прыжка, отдых — медленное дыхание и Z. В спокойном режиме питомец моргает и переводит взгляд. Уменьшение движения и пауза скрытой вкладки сохранены.

Станция и батарея: глянцевые слои пластика и стекла, панельная комната с доком, архивом кассет и растением. Батарея начинается с 65%, расходуется только при взаимодействиях: игра 3%, приветствие 1%, отдых 0%. На доке +5% в минуту по реальному времени (включая отсутствие), предел 100%. Снятие сохраняет накопленный заряд. На зарядке игра отключена; при нуле питомец отдыхает до зарядки без потери имущества и наград. Состояние батареи сохраняется на устройстве отдельно для пользователя; синхронизации через сервер пока нет. Проверены расход, зарядка, перезапуск и математическая модель времени (40 клиентских тестов проходят).

Осмотр в руках: полный 3D-корпус, отдельные объёмные руки, ноги и антенна. Один палец вращает по X/Y, два — по Z; есть стрелки клавиатуры и кнопки крена. Режим «Гладить» распознаёт движения по корпусу, расходует 0,5% на реакцию и показывает спокойное покачивание с репликой вместо сердечек. Всё лицо (глаза, рот, щёчки) следует за последним касанием и сохраняет направление. При нуле батарея автоматически ставится на док, в том числе после восстановления старого сохранения. Комната всегда берёт палитру темы, а настройка меняет лишь освещение.

«Посидеть рядом» — постоянный тихий режим без расхода: зевок, мягкое устраивание и сон до кнопки «Разбудить Яабика» или нового взаимодействия. Добавлены движения ладошки, ножек и антенны в спокойном режиме. Конфеты и аксессуары ещё не реализованы. Проверены поглаживание, одинаковый сдвиг частей лица, полный оборот, отдых/пробуждение и разные палитры комнат; 41 клиентский тест проходит.

У Nyan ушки в осмотре теперь объёмные треугольные призмы. Тетрис меняет основной цвет, квадратность корпуса и панели из тетромино. Во время подхода и зарядки взять в руки нельзя; снять с дока нужно отдельной кнопкой. Подход занимает 1,8 секунды, с шагами и покачиванием; заряд сохраняется сразу, чтобы закрытие приложения во время подхода не отменяло его. Расход снижен: игра 1%, приветствие 0,2%, поглаживание 0,1%.

Расстановка и прогулки: свободный Яабик начинает в центре, док справа (76% ширины). Нажатие на пол задаёт точку в безопасных пределах комнаты по горизонтали и глубине; повторное нажатие меняет маршрут без скачка. Движение идёт CSS-переходами координат, шаги — отдельной анимацией. Длительность зависит от расстояния (0,6–3,5 сек), с уменьшением движения перенос мгновенный. На док он идёт из текущей позиции; снятие с зарядки возвращает в центр. Пока идёт или заряжается, взять в руки нельзя. При перезагрузке свободный питомец снова в центре, заряжающийся — на доке. Проверены центр, выбранная точка на полу и путь к доку.

## Wall activities
Three theme-aware wall buttons: cassette player (reels and dance), collection shelf, and cycling light panel. Yaabik walks to each object; charging blocks interactions. Activities cost no energy.
Shelf reads `/api/discs/shelves` once on mount and displays sealed collectibles belonging to the current player. A random actual item is shown in a miniature sealed case with its own cover and rarity color. Reach/lift/inspect/return animation and rarity-specific dialogue/gestures; empty shelf triggers a sad expression. Collection is read-only: no unsealing or inventory changes. Loading/failure never counts as an empty collection. Reduced motion is respected.

## Personal shelf and cassette song
The room shelf now starts empty and the player selects up to five sealed instance IDs in a native dialog. Only available sealed instances are displayed; users can remove/swap display selections without altering the collection. Selection is saved per player in localStorage (`:shelf`), like other Yaabik preferences, and is not yet synchronized between devices. No inventory or economy write occurs.
Cassette button plays the attached Arduino Caramelldansen arrangement once via a rolling Web Audio scheduler. Source note frequencies, rests, decimal denominators and TEMPO=1100 / gap=1.45 are preserved; short envelopes/lowpass soften the square wave. Dance beat is 398.75 ms, including the Arduino gap. The player can stop with the same button; walking, other activities, leaving the page, or hiding it stops audio. Global music preference applies and app background music is temporarily ducked. Charging still blocks activities; reduced motion has a quiet dance pose.

## MIDI replacement
Cassette music now uses the supplied `Caramella_Girls_-_Caramelldansen_69766082.mid`: 244 notes, overlapping notes and velocities preserved, tempo 120 BPM. Removed 1.625 seconds of leading silence; playable excerpt is 21.215 seconds. Offline extraction in yaabikMidiData.js includes source SHA-256. Soft triangle synthesis replaces the previous Arduino square-wave arrangement; dance beat is now 500 ms. No soundfonts, network requests, or runtime MIDI parser required.

Second user MIDI added as a foreground sine voice (131 notes). Both transcriptions use their original timeline, with only shared leading silence removed. Matching simultaneous backing notes are omitted to avoid doubling; remaining backing uses a quieter triangle voice. No sampled vocals or lyrics are present.

## Final MIDI selection
Replaced both previous transcriptions with user-confirmed `CaramellDansen.mid.mid`. Only original seconds 50 through 73 play (23 seconds); notes crossing either cut are clipped. Source tempo is retained, dance moves every two MIDI quarter notes. Soft electric-style triangle synthesis, no external soundfont. Source SHA-256 and exact clip boundaries are recorded in yaabikMidiData.js.

## Final MIDI selection
Replaced both previous transcriptions with user-confirmed `CaramellDansen.mid.mid`. Only original seconds 50 through 74 play (24 seconds); notes crossing either cut are clipped. Source tempo is retained, dance moves every two MIDI quarter notes. Soft electric-style triangle synthesis, no external soundfont. Source SHA-256 and exact clip boundaries are recorded in yaabikMidiData.js.

## Star projector
Wall light panel is now a lens projector. Yaabik walks over to toggle it and reaches toward the constellation. Twelve SVG stars and a subtle beam use theme colors; projection stays on until toggled off or leaving the room. Opacity animation only, no particle loop/canvas/timers. Reduced motion displays a static projection; hidden app pauses shimmer. Charging blocks interaction. Cassette excerpt extended to 00:50–01:14 (24 seconds).

Tokyo driving theme separately switched to the user-supplied Tokyo drift MIDI: 39 notes at 128 BPM, rendered on demand into a cached 15-second full-bar WAV loop. Existing race audio gates/preferences unchanged.

## Voice, gaze and input
Separate local `yaabikSounds` preference in Profile Settings. Gesture-unlocked Web Audio phrases for greeting, pet/purr, pickup/putdown, play, sleep/wake, disc rarities, projector, docking/undocking and full charge. Hidden/unmount/mute stops scheduled voices; short phrases are throttled. Quiet alternating footsteps run every 300 ms only while walking, without interrupting other phrases; no audio assets/network. Idle antenna check after 45–75 seconds only when idle and visible.
Room face follows last pressed pointer (gaze, mouth and cheeks together), recalculated on arriving. Dock is a keyboard-accessible toggle button. Wall props remain visually behind the robot. Room click capture routes pointer hits within a prop's bounds to its action when the pet's rectangular hit area covers it; semantic keyboard actions retain their own targets. Nav icon now shows the CRT face and antenna.

Room taps now attract attention without pet rewards or battery spend. Four taps with gaps under 2.5 seconds trigger a frown, grumble and screen-smudge complaint; seven taps escalate the line. Calms after 4.2 seconds without further taps. Pet/purr remains only in the explicit in-hands pet mode.

## Server memory (replaces local-only persistence above)
Private `yaabik_states` table registered before the existing create_all startup. `/api/yaabik/open` imports local skin, room, sounds, battery and owned sealed shelf IDs only when no server state exists; later devices use saved server state. Charge/costs computed server-side, time outside app included. `/api/yaabik/actions` batches up to 30 commands, serializes on a per-user DB lock and deduplicates the last 128 request IDs. Patches merge independent settings; shelf validates ownership, sealed slot and maximum five. No wallet, score, notification or global economy lock writes.
Frontend keeps a durable local outbox, debounces writes 450 ms, retries on reconnect/visibility or pending failures (15 s). No continuous successful-state polling. Startup waits for server memory; failures retain local data and expose Retry. Room actions remain optimistic after connection; batches settle to canonical server state. Pending commands survive navigation/reload, with server idempotency for retries. Sounds changed in Settings are queued too. Existing local caches retained as fallback/import sources, never overwrite an existing server companion.
Habits track visits (15-minute visit gap), care, play, music, stars and viewed owned discs. Most-viewed currently displayed disc becomes favourite and is selected 60% of the time; changing shelf never grants items or consumes sealed cases. Greetings reflect server-measured absence, frequent care and music. Idle comments reflect favourite disc or preferred activities; frequent petting gains a familiar response. No penalties, rewards or required upkeep.
Validation: isolated SQLite service/router tests cover first import, cross-device merge, server charging, retries, auto-dock, shelf ownership/limits, favourite and rollback. Production DB/bot not invoked. Studio preview has an independent local mock of these routes.
