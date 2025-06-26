// main.js

// Pobieramy klucz API, który został ustawiony w index.html
const API_KEY = window.userApiKey;

// Sprawdzamy, czy klucz API jest dostępny
if (!API_KEY) {
    // Jeśli z jakiegoś powodu klucz nie został przekazany, wyświetlamy błąd
    const outputDiv = document.getElementById('app-output');
    if (outputDiv) {
        outputDiv.innerHTML = '<p class="error">Błąd: Klucz API nie został prawidłowo przekazany. Odśwież stronę i spróbuj ponownie.</p>';
    }
    console.error('Błąd: Klucz API jest pusty w main.js!');
} else {
    // Klucz API jest dostępny, więc Twój skrypt może zacząć działać
    console.log('Skrypt główny uruchomiony z kluczem API:', API_KEY.substring(0, 5) + '...'); // Wyświetlamy tylko początek klucza ze względów bezpieczeństwa

    // -------- Wstaw TUTAJ swój oryginalny kod skryptu --------
    // WAŻNE: Jeśli Twój skrypt używa 'document.write()', MUSISZ to zmienić!
    // 'document.write()' nadpisze całą stronę. Zamiast tego,
    // manipuluj elementem o id 'app-output'.

    const outputDiv = document.getElementById('app-output');
    if (outputDiv) {
        // Przykład, jak wyświetlać coś w divie 'app-output':
        outputDiv.innerHTML = `
            <p>Witaj! Aplikacja jest gotowa do pracy z kluczem API: <strong>${API_KEY.substring(0, 8)}...</strong></p>
            <p>Tutaj pojawi się zawartość generowana przez Twój skrypt. Możesz dodawać tekst, listy, obrazy itp.</p>
        `;

        // Przykładowe dodawanie innych elementów do outputDiv:
        // const newParagraph = document.createElement('p');
        // newParagraph.textContent = 'To jest dodatkowy akapit wygenerowany przez skrypt.';
        // outputDiv.appendChild(newParagraph);

        // Tutaj możesz umieścić logikę swojego skryptu, która np. robi zapytania do API:
        // fetch(`https://api.example.com/data?apiKey=${API_KEY}`)
        //     .then(response => response.json())
        //     .then(data => {
        //         outputDiv.innerHTML += `<p>Dane z API: ${JSON.stringify(data)}</p>`;
        //     })
        //     .catch(error => {
        //         outputDiv.innerHTML += `<p class="error">Błąd pobierania danych z API: ${error}</p>`;
        //         console.error('Błąd API:', error);
        //     });
    }
    // --------------------------------------------------------
}