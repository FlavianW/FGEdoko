// ==UserScript==
// @name         Randomiser les réponses Google Forms
// @namespace    https://flavianwaroquier.com
// @version      1.10
// @description  Ajoute un bouton pour randomiser les réponses sur Google Forms
// @author       Flavian Waroquier
// @match        https://docs.google.com/forms/d/*/edit*
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    // Fonction pour mélanger un tableau (algorithme de Fisher-Yates amélioré)
    function shuffleArray(array) {
        // Créer une copie du tableau pour éviter de modifier l'original
        const shuffled = [...array];
        
        // Utiliser une meilleure source de nombres aléatoires
        const random = () => {
            const buffer = new Uint32Array(1);
            crypto.getRandomValues(buffer);
            return buffer[0] / (0xffffffff + 1);
        };

        // Mélanger le tableau
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }

        return shuffled;
    }

    // Fonction pour randomiser les réponses
    function randomizeResponses() {
        try {
            // Trouver le conteneur principal
            const mainContainer = document.querySelector('.nMw83b');
            if (!mainContainer) {
                alert("Impossible de trouver le conteneur des réponses !");
                return;
            }

            // Sélectionner tous les conteneurs de réponses
            const responseContainers = mainContainer.querySelectorAll('.PlcjTc');
            if (responseContainers.length === 0) {
                alert("Aucune réponse trouvée !");
                return;
            }

            // Pour chaque conteneur de réponses
            responseContainers.forEach(container => {
                // Sélectionner toutes les réponses dans ce conteneur
                const responses = container.querySelectorAll('.NC79P');
                if (responses.length === 0) return;

                // Convertir en tableau pour pouvoir les mélanger
                const responsesArray = Array.from(responses);
                
                // Mélanger les réponses avec le nouvel algorithme
                const shuffledResponses = shuffleArray(responsesArray);

                // Supprimer toutes les réponses existantes
                while (container.firstChild) {
                    container.removeChild(container.firstChild);
                }

                // Réinsérer les réponses mélangées
                shuffledResponses.forEach(response => {
                    container.appendChild(response);
                });
            });

            alert("Réponses randomisées avec succès !");
        } catch (error) {
            console.error('Erreur lors du mélange des réponses:', error);
            alert("Une erreur est survenue lors du mélange des réponses.");
        }
    }

    // Ajouter le bouton "Randomiser les réponses"
    function addRandomizeButton() {
        if (document.getElementById("randomize-responses-button")) return;

        const button = document.createElement("button");
        button.id = "randomize-responses-button";
        button.textContent = "🔄 Randomiser les réponses";
        button.style.position = "fixed";
        button.style.top = "20px";
        button.style.right = "20px";
        button.style.zIndex = "9999";
        button.style.padding = "12px 24px";
        button.style.background = "#1a73e8";
        button.style.color = "white";
        button.style.border = "none";
        button.style.borderRadius = "25px";
        button.style.cursor = "pointer";
        button.style.fontSize = "14px";
        button.style.fontWeight = "bold";
        button.style.boxShadow = "0 2px 5px rgba(0, 0, 0, 0.2)";
        button.style.transition = "all 0.3s ease";

        // Effet hover
        button.onmouseover = () => {
            button.style.backgroundColor = '#1557b0';
            button.style.transform = 'translateY(-2px)';
            button.style.boxShadow = '0 4px 8px rgba(0,0,0,0.2)';
        };
        
        button.onmouseout = () => {
            button.style.backgroundColor = '#1a73e8';
            button.style.transform = 'translateY(0)';
            button.style.boxShadow = '0 2px 5px rgba(0,0,0,0.2)';
        };

        button.onclick = randomizeResponses;
        document.body.appendChild(button);
    }

    // Fonction pour vérifier si nous sommes sur la page des réponses
    function isResponsesPage() {
        return window.location.href.includes('edit#responses') || 
               document.querySelector('div[role="main"]') !== null;
    }

    // Fonction d'initialisation
    function initialize() {
        if (isResponsesPage()) {
            addRandomizeButton();
        }
    }

    // Initialisation immédiate
    initialize();

    // Écouteur pour les changements d'URL
    window.addEventListener('hashchange', initialize);
})();
