# Catalogue et estimation locale — application 0.13.0

Le bouton **Trouver des modèles pour ma machine**, disponible en Simple et Pro, propose un catalogue limité pour **Apple Silicon + Ollama local**. Il ne prédit ni la qualité, ni les tokens/s, ni la réussite du chargement. Le catalogue et l’estimateur portent chacun la version 1.0.0 ; les estimations ne sont pas des résultats de benchmark et ne sont pas ajoutées aux exports communautaires.

## Parcours

1. Garder Ollama et le backend `npm start` actifs, puis ouvrir la page sur localhost.
2. Ouvrir le catalogue. Consulter RAM physique, réserve et espace libre du volume présumé des modèles.
3. Choisir un contexte entre 1 024 et 32 768 tokens et recalculer. Ce champ configure l’estimation seulement : il ne remplace pas les réglages du benchmark et ne certifie pas le contexte accepté par le modèle.
4. Filtrer famille, Dense/MoE, standard/MLX et modalités déclarées ; cocher les variantes voulues.
5. Confirmer le dossier Ollama affiché. Si le serveur Ollama utilise un autre dossier, donner **le même `OLLAMA_MODELS` au backend et à Ollama**, puis les relancer. Le backend ne connaît pas les variables de l’application Ollama lancée séparément.
6. Cliquer sur **Télécharger les variantes sélectionnées**. La file installe séquentiellement via `127.0.0.1:11434`, sur la machine du backend. Elle ne télécharge pas dans un fournisseur distant ni un serveur Ollama personnalisé.
7. Après installation, la liste du runner Ollama est rafraîchie. Choisir le modèle dans Simple, ou plusieurs dans Pro, puis lancer la campagne existante. Sa chauffe vérifie le chargement ; l’installation seule ne le vérifie pas.

Aucun téléchargement ne commence au simple scan. Aucun modèle n’est supprimé ni chargé pendant l’installation. Les téléchargements peuvent continuer si la fenêtre du catalogue est fermée ; la session serveur permet de retrouver une file active après rechargement de la page. Le suivi est en mémoire : un redémarrage du backend perd la file, sans supprimer les modèles installés. Une autre application ou un autre onglet utilisant Ollama n’est pas synchronisé avec cette file.

## Catalogue initial

Les 13 familles demandées sont présentes, avec **30 variantes**, sources Ollama et date de vérification du 6 octobre 2026 : Qwen3.8, Qwen3.6, Qwen3.8-flash-next, Gemma4, Ornith, Ornith-1.5, Nemotron3, Nemotron-3.5-lightning, MiniMax-M3, Mistral-medium-3.5, Mistral, Mistral-Nemo et Mistral-small3.2.

`model-catalog.json` conserve des tailles publiées arrondies en **GB décimaux**, converties en octets puis affichées en GiB. Lorsque plusieurs tailles étaient affichées, la borne haute a été retenue. Les tags sont mutables ; ce n’est pas un pinning de digest ou de quantification. Avant chaque téléchargement, le backend relit le manifeste officiel du tag, somme les tailles de couches et réévalue les budgets. Une fiche peut évoluer : mettre à jour le catalogue/version/date après vérification des sources.

MiniMax-M3 est **cloud uniquement** dans la bibliothèque vérifiée : il reste visible sans estimation de RAM distante ni téléchargement de poids locaux. Les architectures non confirmées restent inconnues. Les étiquettes vision/audio décrivent la fiche du modèle ; ce catalogue ne fournit pas de benchmark vision/audio. Les variantes MLX nécessitent une version d’Ollama les prenant effectivement en charge. Hugging Face et l’inventaire dynamique de toute la bibliothèque ne sont pas intégrés.

## Formule et couleurs

Soit `W` la taille de téléchargement publiée, `R` la RAM physique et `C` le contexte sélectionné. Pour un seul modèle et une inférence texte :

- réserve système = `max(4 GiB, 20 % de R)` ; budget = `max(0, R − réserve)` ;
- borne basse heuristique = `1,1 × W + 0,5 GiB + C × 64 KiB` ;
- borne haute heuristique = `1,5 × W + 1 GiB + C × 512 KiB`.

**Confiance faible, formule non calibrée.** Ces bornes ne garantissent pas de contenir la consommation réelle. Le cache KV dépend notamment de l’architecture, de sa quantification et du moteur ; les buffers, poids à l’exécution et modalités changent les coûts. Pour un MoE, la formule compte tous les poids téléchargés, pas seulement les paramètres actifs. Aucune estimation de vitesse n’en est déduite.

| Statut | Règle mémoire, avant vérification disque |
|---|---|
| Vert | Borne haute ≤ 85 % du budget après réserve ; marge estimée seulement |
| Orange | Borne basse ≤ budget, mais borne haute > 85 % ; un contexte inférieur peut être suggéré si la même formule le permet |
| Rouge | Borne basse > budget mais ≤ RAM physique ; téléchargement possible seulement avec accord explicite dans l’interface |
| Grisé | Borne basse > RAM physique, plateforme non prise en charge ou espace disque insuffisant ; hors contraintes de ce pilote local sans offload prévu |
| Inconnu | RAM, taille ou espace libre manquant ; téléchargement bloqué |
| Cloud | Aucun calcul matériel local, aucun téléchargement de poids |

Le swap/offload n’est pas considéré comme une façon de rendre un modèle compatible. La réserve forfaitaire ne mesure pas les applications concurrentes. La mémoire libre de `os.freemem()` est affichée séparément : elle n’est pas toute la mémoire récupérable et ne remplace pas la RAM physique dans la formule. Une nouvelle estimation ou une vérification réelle peut changer le verdict.

## Disque, installation et limites

La source disque est `fs.statfs`, `bavail × bsize` sur le dossier des modèles, ou son plus proche parent existant. Le chemin présumé est `OLLAMA_MODELS` du backend, sinon `~/.ollama/models` de son utilisateur. Le chemin local reste dans la fenêtre d’analyse, pas dans les exports de benchmark.

La sélection entière exige `1,1 × somme des tailles + 2 GiB` disponibles ; chaque installation est revérifiée avec le manifeste courant et un nouvel instantané matériel. Le suivi réserve encore 2 GiB et vérifie le disque sur les événements reçus, au plus toutes les deux secondes. Ce n’est pas un quota disque atomique ; d’autres programmes peuvent consommer l’espace entre deux contrôles. Les couches déjà en cache ne sont pas déduites : la vérification peut donc être trop conservatrice. Le pilote ne mesure pas la vitesse du SSD.

La progression est **par couche**, pas une progression totale fictive. Une erreur fournisseur, un manifeste inaccessible/invalide, une fin de flux sans succès ou une réserve disque atteinte arrête la file. Les modèles déjà installés sont conservés. Annuler arrête la requête active et les suivantes ; les couches partielles peuvent rester dans le cache Ollama. Une requête de pull expire après une heure. Les messages d’erreur API bruts ne sont pas affichés.

## Routes et contrôles

| Méthode | Route | Fonction |
|---|---|---|
| GET | `/api/models/advisor/session` | Jeton du processus et ID de file active |
| GET | `/api/models/advisor?context=4096` | Catalogue et estimation, sans téléchargement |
| POST | `/api/models/advisor/download` | Sélection allowlistée, contexte, confirmation de chemin et éventuel accord rouge |
| GET | `/api/models/advisor/jobs/:id` | États et progression par couche |
| POST | `/api/models/advisor/jobs/:id/cancel` | Interruption de la file |

Toutes ces routes exigent un pair loopback, un Host local et une Origin HTTP(S) locale. Le suivi et les mutations demandent `Authorization: Bearer JETON`. Réponses sans cache. Une seule file active par backend ; maximum 50 entrées, sans doublons, cinq dernières files conservées en mémoire. Le client ne peut fournir ni URL de téléchargement ni chemin ni commande shell. Le registre est fixé à `registry.ollama.ai` et le pull à `127.0.0.1:11434`. Les profils/clé API existants ne sont pas envoyés au registre. La consultation locale n’envoie pas l’inventaire ; le téléchargement contacte évidemment les services Ollama.

## Validation

```bash
node backend/model-advisor.test.cjs
node backend/model-advisor-ui.test.cjs
```

Les tests utilisent matériel, réseau, flux NDJSON et DOM simulés ; ils couvrent les familles, seuils, inconnues, disque, sélection, concurrence, erreurs, annulation, origine/jeton, contexte modifié et verrouillage du client. Aucun téléchargement multi-GB, chargement réel ou contrôle visuel Safari/Chrome n’a été réalisé dans cet environnement. Sur Mac : tester une petite variante verte, vérifier son apparition dans `ollama list`, puis faire une campagne ; vérifier aussi filtres, recalcul, annulation et file de deux variantes. Aucun score de compatibilité validé par des données communautaires n’est encore disponible.
