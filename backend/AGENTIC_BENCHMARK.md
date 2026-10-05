# Benchmark agentique · fichiers v1

[Prise en main](../README.md) · [API backend](../BACKEND_README.md) · [Export v2](../schemas/README.md)

Ce premier scénario mesure **modèle + runner + orchestrateur + outils + évaluateur**, avec la version `agentic-files-1.0.0`. Il ne constitue pas une évaluation générale de toutes les capacités agentiques.

## Lancer le scénario

1. Mettre le dépôt à jour, installer les dépendances, puis **redémarrer** le backend avec `npm start`.
2. Servir l’interface depuis ce même dépôt : `python3 -m http.server 8001 --bind 127.0.0.1`.
3. Ouvrir `http://localhost:8001/llm-benchmarker.html`, choisir un runner local et un modèle capable d’appels d’outils natifs.
4. Choisir **Type de benchmark → Agentique · fichiers (v1)**. Les catégories de génération sont remplacées par la description du scénario.
5. Garder 1 répétition pour une première vérification ; utiliser 3 répétitions avec les mêmes réglages pour examiner la variabilité. Lancer la campagne.

Le backend est obligatoire dans ce mode. Ollama utilise `/api/chat` ; LM Studio et llama.cpp utilisent `/v1/chat/completions`. Leur support dépend du modèle et du template de conversation du runner. Une chauffe de génération confirme que le modèle répond, puis le scénario teste réellement les appels d’outils ; une réponse textuelle simulant un appel ne les remplace pas. Un refus de l’API est enregistré comme échec si la session de vérification a été créée.

Références des formats : [Ollama](https://docs.ollama.com/capabilities/tool-calling), [LM Studio](https://lmstudio.ai/docs/developer/openai-compat/tools), [llama.cpp et templates](https://github.com/ggml-org/llama.cpp/blob/master/docs/function-calling.md). API externes, URL personnalisée et Exo ne sont pas activés pour ce premier scénario.

## Tâche et réussite

Le prompt fixe demande au modèle de :

1. Calculer `17 + 25` et appeler `submit_answer` avec `42`.
2. Créer `results` avec `create_directory`.
3. Écrire `results/answer.md` avec `write_markdown` : titre Markdown, `17 + 25 = 42`, section `Vérification` suivie d’un texte explicatif.
4. Relire le fichier avec `read_file`, puis fournir une confirmation finale.

Le backend inspecte le fichier réel, le résultat numérique et la relecture après la dernière écriture. Le contrôle Markdown est **structurel** : il exige titre, équation correcte et section de vérification avec du texte, sans juger la qualité sémantique de toute l’explication. Le modèle n’attribue pas son propre score. Une affirmation « fichier créé » sans ces actions échoue. Une erreur d’outil peut être corrigée avant la fin ; un arrêt, un dépassement de budget ou une boucle non terminée échoue même si un fichier existe.

## Budgets et répétitions

Par tentative : 8 tours de réponse du modèle, 12 appels d’outils maximum, 3 minutes à partir de la création de session. Le plafond de 16 étapes exportées inclut la vérification finale ; ce scénario produit au maximum 13 étapes avec ses 12 appels.

**Tokens max** limite le total des sorties des échanges, avec au maximum 1 024 tokens demandés à chaque tour et le solde du budget. Le compteur du runner est utilisé lorsqu’il est disponible ; sinon une estimation textuelle est explicitement marquée, donc ce plafond n’est pas une garantie de comptage exact. Les échanges accumulent les messages et réponses d’outils. Le thinking est conservé dans la conversation quand Ollama le rapporte ; ses tokens ne sont pas séparés sans compteur fiable.

Une chauffe est mesurée séparément avant les tentatives. Ollama est vérifié avant chaque tentative ; un déchargement détecté interrompt la campagne et demande de relancer. Chaque répétition dispose d’un nouveau dossier, sans réutiliser les fichiers de la précédente. Cela ne réinitialise pas le cache du runner ; son état reste `unknown`. L’arrêt dédié interrompt la requête, demande la vérification en échec et le nettoyage.

## Isolation et fichiers

`backend/agentic-harness.js` crée un répertoire temporaire aléatoire, privé lorsque les permissions Unix sont disponibles. Les seuls chemins admis sont `results` et `results/answer.md` ; taille Markdown limitée à 8 192 octets. Les arguments supplémentaires, chemins alternatifs et liens symboliques sont rejetés. Les outils n’ont ni shell, ni réseau, ni accès aux documents personnels. Les requêtes d’inférence continuent de joindre le runner local.

Il s’agit de restrictions applicatives pour ce scénario, **pas d’une sandbox du système d’exploitation** ni d’une protection contre un autre processus disposant des mêmes droits utilisateur. Les routes exigent une connexion loopback, une origine locale lorsqu’elle est présente, l’en-tête `X-LLMB-Agentic: 1` et un jeton de session pour outils/fin/suppression. Huit sessions simultanées maximum. Ces protections concernent les nouvelles routes agentiques ; elles ne modifient pas celles de télémétrie existantes.

Les fichiers sont supprimés après vérification, abandon ou expiration. Un arrêt brutal du processus backend peut laisser un petit dossier `llmb-agentic-*` dans le répertoire temporaire système ; aucun effacement après crash n’est garanti. Le backend retourne le texte Markdown pour téléchargement et historique local avant suppression. La carte permet de télécharger ce fichier avec le nom du modèle. Les jetons et chemins temporaires ne sont pas enregistrés dans les résultats.

## Résultats, statistiques et partage

Chaque tentative conserve réussite/échec, étapes et vérifications, durées, appels d’outils, reprises après rejet et empreinte SHA-256 du fichier. Une reprise est un nouvel appel du même outil après un rejet ; un simple rejet n’est pas déjà une reprise.

Le temps total comprend orchestration, requêtes modèle, outils et vérification, mais exclut la finalisation de télémétrie. Le débit global cumule les sorties des échanges ; il ne mesure pas la réussite et ne doit pas être comparé au débit d’une génération unique. Le chat est non streaming : **TTFT inconnu**. Les durées de génération/prefill sont additionnées lorsqu’Ollama les rapporte. RSS et télémétrie restent disponibles avec Ollama ; elles ne sont pas collectées pour LM Studio/llama.cpp par ce scénario.

Dans **Statistiques**, un bloc agentique séparé regroupe les mêmes modèles/scénarios/conditions et montre réussite/tentatives, durée et appels moyens, avec détail repliable. Les échecs restent au dénominateur. Les courbes de génération excluent les essais agentiques. L’assistant IA reçoit les scores et mesures synthétiques, sans contenu des fichiers, arguments d’outils ou jetons.

L’export communautaire v2 contient `kind: agentic`, orchestrateur, politique, outils, budgets, étapes, artefacts (chemins relatifs fixes et empreinte) et évaluation. Il exclut le contenu du Markdown créé et les arguments bruts. Le rapport Markdown ajoute le tableau des étapes et contient déjà les prompts/réponses : vérifier avant partage. Aucun envoi au futur site n’est activé.

## Validation

```bash
node backend/agentic-harness.test.cjs
node backend/agentic-integration.test.cjs
node schemas/test.cjs
```

Les tests exécutent de vraies opérations sur des dossiers temporaires et simulent les réponses structurées Ollama/compatibles. Ils couvrent réussite, déclaration sans action, reprises, boucles, limites, expiration, nettoyage, chemins/liens interdits, jetons, accès local, export v2, statistiques, assistant, chauffe/historique et propagation d’annulation. Ils ne prouvent pas la réussite d’un modèle réel : celle-ci est à vérifier sur votre Mac avec plusieurs modèles compatibles.

Exo reste une étape distincte. Après validation de ce scénario et des exports réels, le site communautaire pourra commencer par l’import manuel v2 avant un envoi authentifié.
