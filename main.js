// main.js - Przerobiona logika aplikacji na JavaScript dla szybszego działania

// Klucz API YouTube
// PAMIĘTAJ O OGRANICZENIACH KLUCZA W GOOGLE CLOUD CONSOLE!
// Ten klucz API (AIzaSyAcO7J4HE7cqBIv3ObDAEIRH0NRGnYOzo8) jest używany dla API komentarzy.
const API_KEY = "AIzaSyAcO7J4HE7cqBIv3ObDAEIRH0NRGnYOzo8";

// Elementy DOM
const videoInput = document.getElementById('videoInput');
const loadVideoButton = document.getElementById('loadVideoButton');
const pauseButton = document.getElementById('pauseButton');
const statusLabel = document.getElementById('statusLabel');
const duplicatesTableBody = document.getElementById('duplicatesTable').querySelector('tbody');
const openLastDuplicateButton = document.getElementById('openLastDuplicateButton');
const resetButton = document.getElementById('resetButton');

// Zmienne stanu aplikacji
let videoId = null;
let checkedChannels = new Set(); // Przechowuje ID kanałów, których opisy już pobraliśmy
let descriptionMap = {}; // Mapowanie: opis -> [{id, name, url}] - przechowuje duplikaty
let duplicateHistory = []; // Lista duplikatów do wyświetlenia w tabeli
let lastDuplicateUrl = null;
let messageCount = 0; // Licznik przetworzonych komentarzy
let isPaused = false; // Czy pobieranie jest wstrzymane
let nextPageToken = null; // Token do pobrania kolejnej strony komentarzy
let pagesFetched = 0; // Licznik pobranych stron
let isFetching = false; // Flaga, czy pobieranie jest w trakcie
let abortController = null; // Do przerywania zapytań fetch

// Funkcja do pobierania JSON z API
async function fetchJson(url) {
    try {
        if (!abortController) {
            abortController = new AbortController();
        }
        const response = await fetch(url, { signal: abortController.signal });
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ message: "Brak szczegółów błędu." }));
            const errorMessage = errorData.error?.message || errorData.message || `HTTP error! status: ${response.status}`;
            console.error(`Błąd HTTP: ${response.status} przy ${url}. Szczegóły: ${errorMessage}`);
            statusLabel.textContent = `Status: Błąd API: ${errorMessage}`;
            throw new Error(errorMessage);
        }
        return await response.json();
    } catch (error) {
        if (error.name === 'AbortError') {
            console.log('Zapytanie przerwane przez użytkownika.');
            statusLabel.textContent = 'Status: Operacja przerwana.';
        } else {
            console.error(`Błąd podczas pobierania danych z API: ${error}`);
            statusLabel.textContent = `Status: Błąd podczas pobierania danych: ${error.message}.`;
        }
        isFetching = false; // Zakończ pobieranie w przypadku błędu/przerwania
        return null;
    }
}

// Funkcja do pobierania opisu kanału
async function getChannelDescription(channelId) {
    // Jeśli kanał już sprawdzony, nie wykonuj kolejnego zapytania API
    if (checkedChannels.has(channelId)) {
        return null; // Zwróć null, aby zasygnalizować, że nie ma potrzeby dalszego przetwarzania
    }
    
    const url = `https://www.googleapis.com/youtube/v3/channels?part=snippet&id=${channelId}&key=${API_KEY}`;
    const data = await fetchJson(url);
    if (!data) return null; // Jeśli błąd pobierania, zwróć null

    const items = data.items || [];
    if (!items.length) {
        checkedChannels.add(channelId); // Dodaj do sprawdzonych, nawet jeśli brak danych
        return ""; // Pusty opis
    }
    const description = items[0].snippet?.description || "";
    checkedChannels.add(channelId); // Dodaj kanał do zbioru sprawdzonych
    return description.trim();
}

// Funkcja do przetwarzania komentarzy
async function processComments(comments) {
    const promises = [];
    for (const comment of comments) {
        if (isPaused || (abortController && abortController.signal.aborted)) {
            console.log('Przetwarzanie wstrzymane/przerwane.');
            // Jeśli przerwano, zwróć null, aby zatrzymać dalsze przetwarzanie w tej iteracji
            return null; 
        }

        const topComment = comment.snippet?.topLevelComment;
        if (!topComment) continue;

        const authorInfo = topComment.snippet?.authorChannelId;
        const channelId = authorInfo?.value;
        const channelName = topComment.snippet?.authorDisplayName;
        const publishedAt = topComment.snippet?.publishedAt;

        if (!channelId) continue;

        // Użyj Promise.all, aby równolegle pobierać opisy kanałów
        // ale tylko dla tych, które jeszcze nie były sprawdzone
        if (!checkedChannels.has(channelId)) {
            promises.push((async () => {
                const description = await getChannelDescription(channelId);
                if (description === null || description === "") {
                    return; // Opis był już sprawdzony, pusty lub wystąpił błąd
                }

                if (descriptionMap[description]) {
                    let existingChannels = descriptionMap[description];
                    if (!existingChannels.some(ch => ch.id === channelId)) {
                        existingChannels.push({
                            id: channelId,
                            name: channelName,
                            url: `https://www.youtube.com/channel/${channelId}` // Poprawiony URL kanału
                        });
                        // Usuń stary wpis duplikatu i dodaj zaktualizowany
                        duplicateHistory = duplicateHistory.filter(d => d.desc !== description);
                        duplicateHistory.push({
                            time: new Date(publishedAt).toLocaleString('pl-PL', { dateStyle: 'short', timeStyle: 'short' }),
                            desc: description,
                            channels: existingChannels
                        });
                        lastDuplicateUrl = existingChannels[0].url; // Aktualizuj ostatni duplikat
                    }
                } else {
                    descriptionMap[description] = [{
                        id: channelId,
                        name: channelName,
                        url: `https://www.youtube.com/channel/${channelId}` // Poprawiony URL kanału
                    }];
                }
                messageCount++; // Zlicz przetworzone komentarze tylko dla unikalnych kanałów z opisem
            })());
        }
    }
    await Promise.all(promises); // Poczekaj na zakończenie wszystkich operacji pobierania opisów
    return true; // Zwróć true, jeśli przetwarzanie zakończono bez przerwy
}

// Funkcja do pobierania stron komentarzy
async function fetchCommentsPage() {
    if (!API_KEY) {
        statusLabel.textContent = "Błąd: Klucz API nie został załadowany.";
        isFetching = false;
        return;
    }

    if (pagesFetched >= 100 && !isPaused) { // Limit stron, aby nie przekroczyć limitu API
        statusLabel.textContent = `Status: Osiągnięto limit ${pagesFetched} stron komentarzy. Zakończono.`;
        isFetching = false;
        return;
    }
    if (!videoId) {
        statusLabel.textContent = "Status: Brak ID filmu. Wprowadź ID lub link.";
        isFetching = false;
        return;
    }

    if (isPaused) {
        statusLabel.textContent = 'Status: Pauza. Kliknij "Wznów" by kontynuować.';
        return;
    }
    
    statusLabel.textContent = `Status: Pobieram komentarze, strona ${pagesFetched + 1}...`;

    let baseUrl = `https://www.googleapis.com/youtube/v3/commentThreads?part=snippet&videoId=${videoId}&maxResults=100&key=${API_KEY}`;
    if (nextPageToken) {
        baseUrl += `&pageToken=${nextPageToken}`;
    }

    const data = await fetchJson(baseUrl);
    if (!data) { // Błąd pobierania lub operacja przerwana
        isFetching = false;
        return;
    }

    const comments = data.items || [];
    nextPageToken = data.nextPageToken || null;

    const processingResult = await processComments(comments);
    if (processingResult === null) { // Jeśli przetwarzanie zostało przerwane
        isFetching = false;
        return;
    }

    pagesFetched++;
    refreshGui(); // Odśwież GUI po każdej stronie

    if (nextPageToken && !isPaused && !(abortController && abortController.signal.aborted)) {
        // Kontynuuj pobieranie kolejnej strony z minimalnym opóźnieniem
        // Zmniejszenie opóźnienia z 300ms na 50ms, ale z rozwagą - zbyt szybkie może wywołać limity API
        setTimeout(fetchCommentsPage, 50); 
    } else if (!nextPageToken) {
        statusLabel.textContent = `Status: Zakończono sprawdzanie. Znaleziono ${duplicateHistory.length} duplikatów.`;
        isFetching = false;
    } else if (abortController && abortController.signal.aborted) {
        statusLabel.textContent = 'Status: Operacja przerwana.';
        isFetching = false;
    }
}

// Funkcja do odświeżania GUI (tabeli i statusu)
function refreshGui() {
    statusLabel.textContent =
        `Status: ${isPaused ? 'PAUZA' : (isFetching ? 'AKTYWNY' : 'Zakończono / Czekam na film')} | ` +
        `Kanałów sprawdzonych: ${checkedChannels.size} | ` +
        `Duplikatów: ${duplicateHistory.length} | ` +
        `Komentarzy przetworzonych: ${messageCount}`;

    duplicatesTableBody.innerHTML = ''; // Wyczyść tabelę

    duplicateHistory.sort((a, b) => new Date(b.time) - new Date(a.time)); // Sortuj od najnowszych

    duplicateHistory.forEach(dup => {
        const row = duplicatesTableBody.insertRow();

        const timeCell = row.insertCell(0);
        timeCell.textContent = dup.time;

        const descCell = row.insertCell(1);
        descCell.textContent = dup.desc.substring(0, 80) + (dup.desc.length > 80 ? '...' : '');

        const channelsCell = row.insertCell(2);
        channelsCell.innerHTML = dup.channels.map(ch =>
            `<a href="${ch.url}" target="_blank" rel="noopener noreferrer">${ch.name}</a>`
        ).join('<br>');
    });
}

// Funkcja do uruchomienia aplikacji
function loadVideo() {
    if (isFetching) {
        statusLabel.textContent = "Status: Już pobieram komentarze. Poczekaj lub zresetuj.";
        return;
    }

    let text = videoInput.value.trim();
    videoId = null;

    if (!text) {
        statusLabel.textContent = "Wpisz poprawny ID lub link filmu.";
        return;
    }

    // Usunięto zapisywanie ostatnio wpisanego ID filmu do localStorage
    // localStorage.setItem('lastVideoId', text); 

    // Proste parsowanie linku YT (obsługuje np. youtu.be/6, youtu.be/7)
    const youtubeRegex = /(?:youtube\.com\/(?:[^\/\n\s]+\/\S+\/|(?:v|e(?:mbed)?)\/|\S*?[?&]v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
    const match = text.match(youtubeRegex);

    if (match && match[1]) {
        videoId = match[1];
    } else if (text.length === 11 && /^[a-zA-Z0-9_-]{11}$/.test(text)) {
        // Zakładamy, że to już jest ID filmu, jeśli ma 11 znaków i odpowiednie znaki
        videoId = text;
    } else {
        statusLabel.textContent = "Nie udało się wyciągnąć ID filmu z linku. Wpisz poprawne ID lub link.";
        return;
    }

    // Resetowanie stanu
    checkedChannels.clear();
    descriptionMap = {};
    duplicateHistory = [];
    lastDuplicateUrl = null;
    messageCount = 0;
    nextPageToken = null;
    pagesFetched = 0;
    isPaused = false;
    pauseButton.textContent = "Pauza";
    duplicatesTableBody.innerHTML = '';
    if (abortController) { // Upewnij się, że poprzednie zapytania są anulowane
        abortController.abort();
    }
    abortController = new AbortController(); // Nowy kontroler dla nowej sesji

    statusLabel.textContent = `Załadowano film ID: ${videoId}. Rozpoczynam pobieranie komentarzy...`;
    isFetching = true;
    fetchCommentsPage(); // Rozpocznij pobieranie
}

// Funkcja do przełączania pauzy
function togglePause() {
    isPaused = !isPaused;
    pauseButton.textContent = isPaused ? "Wznów" : "Pauza";
    if (!isPaused && !isFetching && nextPageToken !== null) { // Jeśli wznowiono i nie pobierano, kontynuuj
        isFetching = true;
        fetchCommentsPage();
    } else if (!isPaused && !isFetching && nextPageToken === null && pagesFetched > 0) {
          // Jeśli wznowiono i skończono pobieranie, po prostu odśwież status
        statusLabel.textContent = `Status: Zakończono sprawdzanie. Znaleziono ${duplicateHistory.length} duplikatów.`;
    }
    refreshGui();
}

// Funkcja do otwierania ostatniego duplikatu
function openLastDuplicate() {
    if (lastDuplicateUrl) {
        window.open(lastDuplicateUrl, '_blank');
    } else {
        statusLabel.textContent = "Brak ostatniego duplikatu do otwarcia.";
    }
}

// Funkcja resetująca wszystko
function resetApp() {
    if (abortController) {
        abortController.abort(); // Przerwij wszystkie bieżące zapytania
        abortController = null; // Zresetuj kontroler
    }
    videoId = null;
    checkedChannels.clear();
    descriptionMap = {};
    duplicateHistory = [];
    lastDuplicateUrl = null;
    messageCount = 0;
    isPaused = false;
    nextPageToken = null;
    pagesFetched = 0;
    isFetching = false;
    pauseButton.textContent = "Pauza";
    videoInput.value = ""; // WYCZYŚĆ POLE INPUT PRZY RESECIE
    duplicatesTableBody.innerHTML = '';
    statusLabel.textContent = "Status: Aplikacja zresetowana. Wprowadź ID filmu i kliknij 'Załaduj film'.";
    localStorage.removeItem('lastVideoId'); // Usuń zapamiętany ID filmu (dla pewności, choć już nie zapisujemy)
}

// Event Listenery
loadVideoButton.addEventListener('click', loadVideo);
pauseButton.addEventListener('click', togglePause);
openLastDuplicateButton.addEventListener('click', openLastDuplicate);
resetButton.addEventListener('click', resetApp);

// USUNIĘTO: Automatyczne ładowanie zapamiętanego ID filmu przy starcie strony.
// Dzięki temu pole input zawsze będzie puste po otwarciu strony.
