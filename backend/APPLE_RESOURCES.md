# Télémétrie Apple : MLX, swap et activité disque

La collecte est réservée à macOS, avec Ollama et le backend Node.js.
L'interface crée une session avant la génération, échantillonne pendant le test et termine après le flux.
Le temps des requêtes de finalisation n'est pas ajouté à la durée du benchmark.

## Sources et portée

| Donnée | Source | Limite |
|---|---|---|
| Swap utilisé, pic échantillonné | sysctl -n vm.swapusage | Système entier |
| Mémoire compressée | vm_stat, pages occupées par le compresseur × taille de page | Système entier |
| Swap lu/écrit | Différence Swapins/Swapouts × taille de page | Équivalent pages, pas taille compressée réelle des E/S |
| Lectures/écritures disques | ioreg IOBlockStorageDriver, Statistics Bytes (Read)/(Write) | Système entier, uniquement pilotes exposant ces compteurs |
| Pic allocateur MLX | Nouveaux événements memory peak du server.log Ollama | Valeur arrondie du log, pas toute la RAM du modèle |
| Contexte runner | Ollama /api/ps context_length, modèle exact | Contexte du runner chargé, distinct du maximum /api/show |

Les compteurs disque sont des deltas depuis le début de la session. Les changements de périphériques,
compteurs réinitialisés et données manquantes rendent le delta inconnu. Aucun fichier utilisateur n'est
lu pour tester la vitesse SSD. Les autres applications et les propres commandes de monitoring participent
à l'activité système. Il n'y a pas encore de mesure par disque associée au fichier du modèle.

Le chemin du log est fixe : ~/.ollama/logs/server.log. Seuls les octets ajoutés après le début
de la session sont examinés. Aucune ancienne valeur MLX n'est récupérée. Les dates et unités sont vérifiées ;
les lignes partielles sont conservées jusqu'à leur fin. Une rotation/troncature ou plus de 1 MiB ajouté
entre deux lectures invalide la mesure MLX. Aucun texte du log, prompt, chemin privé ou erreur brute
n'est retourné par l'API de télémétrie.

L'événement mémoire ne contient pas d'identifiant fiable de requête/modèle :
l'attribution est explicitement **ollama-server-unverified-model**. Utilisez Ollama sans autre génération
concurrente pour réduire cette ambiguïté. Aucun événement MLX n'est attendu pour un runner GGUF.
L'application Ollama doit écrire ce log ; avec ollama serve lancé seulement dans un terminal, il peut manquer.

## API locale

- POST /api/telemetry/start : identifiant opaque, mesure initiale, état d'accès au log.
- GET /api/telemetry/:id : échantillon et résumés ; ?finish=1 ajoute les séries et ferme la session.
- DELETE /api/telemetry/:id : abandon et nettoyage.
- Hors macOS : début de session non supporté (501).

Sessions en mémoire : 16 maximum, durée maximale 30 minutes, 1800 échantillons maximum.
Les commandes sont fixes, sans shell ni chemin fourni par le client, avec timeout 2,5 secondes
et sortie bornée à 4 MiB. Aucune installation, commande sudo ou compilation native n'est nécessaire.

## Tests

```bash
node backend/apple-resources.test.cjs
node backend/monitor-integration.test.cjs
node backend/community-export.test.cjs
```

Tests simulés : unités, pages 4/16 KiB, zéro/inconnu, compteurs, curseur de log, dates,
lignes partielles, rotation, expiration, confidentialité, contexte Auto et nettoyage sur erreur.
La collecte réelle doit encore être vérifiée sur les différentes versions macOS/Ollama.
