# LLM Benchmarker Local 🚀

> **Version 0.06** - Benchmark de modèles LLM locaux et externes directement depuis le navigateur
>
> **Développé par** [NVNC](https://nvnc.fr) ✨
>
> **Nouveautés** : Support Gemini ✨ | Monitoring RAM Ollama 💾 | Backend optionnel | Fix timeout modèles lourds (>30B) ⏱️ | **Détection GPU intelligente** 🎮 | **Modes Auto/Manuel** ⚙️ | **Config par type de prompt** 📝 | **Fix bug RAM 0MB** 🐛 | **Détection backend améliorée** 🔄

> **Projet en version alpha** — Les fonctionnalités et mesures peuvent comporter des erreurs ; leur validation dépend du matériel et de l'environnement.

[![License: Apache 2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](LICENSE)
[![Status: Alpha](https://img.shields.io/badge/Status-Alpha-orange.svg)]
[![Browser: Chrome/Firefox/Safari](https://img.shields.io/badge/Browser-Chrome%20%7C%20Firefox%20%7C%20Safari-blue.svg)]

---

## 📖 Sommaire

- [🚀 Premier benchmark avec Ollama](#-premier-benchmark-avec-ollama)
- [⚙️ Options de lancement](#️-options-de-lancement)
- [🎯 Fonctionnalités](#-fonctionnalités)
- [Documentation technique](TECHNICAL_README.md)
- [Backend RAM et GPU](BACKEND_README.md)
- [🔧 Configuration](#-configuration)
- [📊 Comprendre les mesures](#-comprendre-les-mesures)
- [📝 Export des résultats](#-export-des-résultats)
- [💾 Stockage](#-stockage)
- [📜 Licence](#-licence)
- [🤝 Contribuer](#-contribuer)
- [⚠️ Limitations connues](#️-limitations-connues)
- [Précautions d'utilisation](#précautions-dutilisation)

---

## 🚀 Premier benchmark avec Ollama

### 1. Préparer Ollama

Installez [Ollama](https://ollama.com), puis assurez-vous que son serveur fonctionne sur `http://localhost:11434`. Si l'application ne l'a pas déjà démarré, lancez `ollama serve` dans un terminal séparé.

Téléchargez un modèle pour votre premier test :

```bash
ollama pull llama3.2:1b
ollama list
```

Le téléchargement du modèle nécessite une connexion internet.

### 2. Télécharger et ouvrir l'application

Prérequis : Git et Python 3, ainsi qu'un navigateur récent.

```bash
git clone https://github.com/DredGuer/LLM-Benchmarck.git
cd LLM-Benchmarck
python3 -m http.server 8001
```

Gardez ce terminal ouvert et accédez à [LLM Benchmarker](http://localhost:8001/llm-benchmarker.html).

Sans Git, téléchargez [l'archive du dépôt](https://github.com/DredGuer/LLM-Benchmarck/archive/refs/heads/main.zip), décompressez-la, puis lancez `python3 -m http.server 8001` depuis le dossier extrait `LLM-Benchmarck-main`.

Conservez tous les fichiers du dépôt. Ouvrez l'application via le serveur HTTP, plutôt qu'en double-cliquant sur le fichier HTML. Le runner doit également autoriser les requêtes depuis cette origine ; un serveur web local ne résout pas à lui seul toutes les erreurs CORS.

### 3. Lancer un premier test

1. Les modèles Ollama sont récupérés automatiquement à l’ouverture. Sélectionnez **llama3.2:1b** ; utilisez 🔄 pour réessayer si Ollama était arrêté.
2. Sélectionnez uniquement **Conversation**.
3. Gardez le **mode Manuel**, choisissez **256 tokens max** et **1 répétition** pour un essai court.
4. Cliquez sur **⚡ Lancer le benchmark**.
5. Suivez la réponse dans **Thinking en direct**, puis consultez **📊 Résultats**.
6. Cliquez sur **📄 Exporter .md** pour télécharger le rapport.

Le backend Node.js n'est pas nécessaire pour ce premier benchmark.

## ⚙️ Options de lancement

### Relancer après une mise à jour

Depuis votre copie du dépôt (pas depuis le dossier personnel), arrêtez le backend avec **Ctrl+C**, puis :

```bash
git pull origin main
npm install
node backend/apple-inventory.test.cjs
node backend/model-metadata.test.cjs
node schemas/test.cjs
npm start
```

Gardez ce terminal ouvert. Dans un **deuxième terminal**, placez-vous dans le même dossier du dépôt et lancez :

```bash
python3 -m http.server 8001
```

Ouvrez **http://localhost:8001/llm-benchmarker.html**. Ollama doit également fonctionner sur le port 11434 :
ouvrez son application, ou lancez `ollama serve` dans un troisième terminal si son serveur n'est pas déjà actif.

Le backend Node.js (3001), l'interface Python (8001) et Ollama (11434) sont trois services distincts.
Arrêtez chaque serveur avec **Ctrl+C** dans son terminal.

Sur Windows, remplacez `python3` par `py -3` si nécessaire.

### Vérifier les services

Dans un terminal libre :

```bash
curl -fsS http://localhost:3001/api/ping
curl -fsS http://localhost:3001/api/memory
curl -fsS http://localhost:3001/api/ollama/models
curl -fsS http://localhost:11434/api/ps
```

Pour l'inventaire Apple sur macOS :

```bash
curl -fsS http://localhost:3001/api/hardware
```

Il fournit CPU/cœurs, RAM unifiée, GPU/cœurs, disques physiques et provenance.
La fréquence CPU peut être inconnue ; le débit SSD n'est pas encore mesuré.
Voir [les sources et limites de l'inventaire Apple](backend/APPLE_INVENTORY.md).

### Interface ancienne, cache ou port occupé

Après une mise à jour, rechargez l'interface avec **⌘⇧R sur Mac** ou **Ctrl+Shift+R sur Windows/Linux**.
Si elle reste ancienne, videz uniquement le cache des fichiers du site : effacer les données du site
supprime aussi l'historique, les clés et réglages locaux. Vérifiez l'adresse et le dossier depuis lequel
le serveur Python a été lancé. Les exports actuels indiquent **v0.06**, les sources mémoire et un bloc JSON.

Pour vérifier le fichier réellement servi :

```bash
curl -fsS "http://localhost:8001/js/ui/results.js?v=0.06-apple-export1"
```

Il doit contenir `Inventaire Apple détecté` et `buildCommunityExport`.
Lancez un **nouveau test** : les résultats historiques ne récupèrent pas rétroactivement les données manquantes.

Si `npm start` indique `EADDRINUSE`, un service utilise déjà le port 3001.
Sur macOS/Linux, identifiez-le avec :

```bash
lsof -nP -iTCP:3001 -sTCP:LISTEN
```

Arrêtez votre ancien backend dans son terminal, puis relancez `npm start`.
Si le port 8001 est occupé, arrêtez votre ancien serveur web ou utilisez
`python3 -m http.server 8002` et ouvrez alors le port 8002 dans le navigateur.

### Autres runners et fournisseurs

- **LM Studio** : démarrez son serveur local (port 1234 par défaut), chargez un modèle, puis sélectionnez LM Studio.
- **llama.cpp** : démarrez un serveur compatible avec l'API de chat OpenAI (port 8080 par défaut), puis sélectionnez llama.cpp.
- **OpenAI, Mistral, Claude ou Gemini** : utilisez une clé API valide, configurez-la via **🔑 Clés API**, puis choisissez le fournisseur et un modèle disponible pour votre compte. Ces requêtes nécessitent internet et peuvent être facturées par le fournisseur.
- **Personnalisé** : renseignez l'URL du serveur et le nom du modèle.

### Monitoring RAM Ollama (optionnel)

Avec Node.js et npm installés, ouvrez un autre terminal **à la racine du dépôt** :

```bash
npm install
npm start
```

Le backend démarre sur `http://localhost:3001` et l'interface tente de le détecter automatiquement. Gardez aussi le serveur web du premier terminal en fonctionnement.

La RAM suivie par le backend est la somme des mémoires résidentes (RSS) des processus Ollama détectés et de leurs descendants, y compris les runners MLX. Les pages partagées peuvent être comptées plusieurs fois ; cette somme n'est ni la VRAM ni le pic d'allocation MLX des logs. La mémoire JavaScript du navigateur, lorsqu'elle est disponible, mesure autre chose et ne doit pas être interprétée comme la RAM du modèle.

Consultez [la documentation du backend](BACKEND_README.md) pour les ports, les méthodes de mesure, la détection GPU et le dépannage.

### Autres serveurs web

Depuis la racine du dépôt, vous pouvez remplacer le serveur Python par :

```bash
php -S localhost:8001
```

Ouvrez alors la même URL sur le port 8001. Avec MAMP, placez **tout le dépôt** dans le répertoire web configuré et utilisez l'URL correspondant à ce dossier.

---

## 🎯 Fonctionnalités

### Runners locaux supportés

| Runner | Endpoint | Protocole | Monitoring RAM |
|--------|----------|-----------|----------------|
| 🦙 **Ollama** | `http://localhost:11434` | API native Ollama (streaming) | ✅ **Oui** (via backend) |
| 🏠 **LM Studio** | `http://localhost:1234` | OpenAI-compatible | ❌ Non |
| 🦔 **llama.cpp** | `http://localhost:8080` | OpenAI-compatible | ❌ Non |

### APIs externes

| Fournisseur | Endpoint | Nécessite clé API | Monitoring RAM |
|-------------|----------|------------------|----------------|
| 🤖 **OpenAI** | `https://api.openai.com` | ✅ Oui | ❌ Non |
| 🌊 **Mistral AI** | `https://api.mistral.ai` | ✅ Oui | ❌ Non |
| 🔮 **Anthropic Claude** | `https://api.anthropic.com` | ✅ Oui | ❌ Non |
| 💎 **Google Gemini** | `https://generativelanguage.googleapis.com` | ✅ Oui | ❌ Non |
| ⚙️ **Personnalisé** | Configurable | ❌ Non | ❌ Non |

### Types de prompts

- 💬 **Conversation** - Dialogue libre et réponses générales
- 🏛️ **Datation / Factuel** - Questions de culture générale datées
- 🔢 **Mathématiques** - Résolution de problèmes mathématiques
- 💻 **Code** - Génération ou analyse de code
- 🧠 **Logique** - Résolution de problèmes logiques et raisonnement
- 🎨 **Créatif** - Rédaction créative et brainstorming
- ✏️ **Personnalisé** - Votre propre question ou instruction

### Métriques collectées

| Métrique | Description | Disponible |
|----------|-------------|-----------|
| Tokens générés | Nombre total de tokens produits | ✅ Tous |
| Tokens/seconde | Vitesse de génération | ✅ Tous |
| TTFT (Time To First Token) | Temps avant le premier token | ✅ Ollama (streaming) |
| Temps total | Durée complète de la réponse | ✅ Tous |
| Température | Paramètre de créativité utilisé | ✅ Tous |
| **RSS cumulée pic** | Maximum des échantillons RSS, en MiB | ✅ Ollama (avec backend) |
| **RSS cumulée moyenne** | Moyenne des échantillons RSS, en MiB | ✅ Ollama (avec backend) |
| **Modèle chargé** | Taille déclarée par Ollama, en GiB ; pas un pic RAM | ✅ Ollama (avec backend) |

### Fonctionnalités de debugging

- **Streaming en temps réel** : Visualisation de la réponse token par token pour Ollama
- **Logs de débogage** : Suivi détaillé de chaque test avec horodatage
- **Compteur de tokens** : Suivi en direct du nombre de tokens reçus
- **Barre de progression** : Visualisation du % de tokens reçus vs max
- **Arrêt/Interrompre** : Contrôle manuel pendant le benchmark
- **Monitoring RAM** : Surveillance en temps réel de la consommation mémoire

---

## 🔧 Configuration

### Configuration des clés API

1. Cliquez sur le bouton **"🔑 Clés API"** dans la barre d'outils
2. Saisissez vos clés API pour chaque fournisseur (**Gemini** inclus)
3. Sauvegardez

Les clés sont conservées dans le `localStorage` du navigateur. Lors d'un appel à une API externe, la clé nécessaire à l'authentification et le prompt sont transmis au fournisseur sélectionné.

**Nouveau : Clé API Gemini**
- Format : `AIzaxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`
- Obtenez-la sur : https://aistudio.google.com/app/apikey

### Runner personnalisé

Pour utiliser un runner personnalisé :

1. Sélectionnez **⚙️ Personnalisé**
2. Entrez l'URL de base de votre API (ex: `http://localhost:8080`)
3. Entrez le nom du modèle
4. Lancez le benchmark

### Architecture du modèle et contexte

Pour Ollama, l'interface interroge `/api/show` à la sélection du modèle et avant le benchmark :
architecture, paramètres totaux, experts totaux/actifs, quantification et contexte maximal déclaré.
La classification Dense/MoE est fondée sur le nombre d'experts déclaré ; si ce champ manque,
elle reste inconnue, même si le nom semble indiquer MoE.

Le champ **Contexte demandé à Ollama** transmet `num_ctx` dans les modes Auto et Manuel.
Laissez-le vide pour conserver le réglage du runner. Cette valeur demandée et le maximum du
modèle ne sont pas une mesure de la fenêtre réellement allouée. Le réglage ne s'applique
pas aux autres fournisseurs à cette étape. Les valeurs sont conservées dans les résultats et l'export.

Dense et MoE ne se comparent pas sur le seul nombre de paramètres totaux :
les experts actifs, le contexte, la quantification et les ressources matérielles influencent le débit.
L'outil ne déduit pas un nombre de paramètres actifs à partir du ratio d'experts.

L'inventaire matériel est repliable. Le débit SSD reste inconnu dans les données et sa ligne
est masquée dans l'interface et le Markdown tant qu'aucune mesure n'est disponible.

### État du plan progressif

| Étape | État |
|---|---|
| Schéma commun v2, topologies multi-GPU/machines et tâches agentiques | Contrat et exemples testés ; export actif encore v1 |
| Inventaire Apple Silicon : CPU/cœurs, RAM unifiée, GPU/cœurs, SSD et provenance | Collecté ; vérifié sur un M3 Pro |
| Ergonomie, récupération automatique des modèles, contexte demandé, métadonnées Dense/MoE | Implémenté ; validation sur Mac à poursuivre |
| Pic réel MLX, mémoire compressée/swap, consommation par GPU | À implémenter ; RSS et taille déclarée ne remplacent pas ces mesures |
| Débit/activité SSD et bande passante mémoire | À implémenter |
| Inventaires et télémétrie Windows/Linux, multi-GPU | À fiabiliser et tester sur les machines concernées |
| Export runtime v2 complet et protocole reproductible | À implémenter |
| Exo et collecte par nœud multi-machine | Prévu par le schéma ; intégration non implémentée |
| Exécution des tests agentiques en espace isolé | Prévue par le schéma ; exécuteur non implémenté |
| Site communautaire et envoi sécurisé | À concevoir et implémenter |

### Options avancées

| Option | Description | Valeur par défaut |
|--------|-------------|------------------|
| Température | Paramètre d'échantillonnage (0 réduit l'aléatoire sans garantir la reproductibilité) | 0.7 |
| Tokens max | Nombre maximum de tokens à générer | **4096** |
| Répétitions | Nombre de fois à exécuter chaque test | 1 |

## 📊 Comprendre les mesures

- **Tokens et tokens/seconde** : décrivent la génération, pas la qualité de la réponse.
- **TTFT** : disponible avec le streaming Ollama ; inclut le délai observé avant le premier token.
- **Temps total** : durée observée de la requête, influencée par le chargement du modèle et les communications.
- **RAM pic et moyenne** : statistiques des échantillons de RSS cumulée de l'arbre de processus surveillé pendant le test, avec le backend Ollama. La RAM du navigateur est une mesure distincte.
- **Modèle chargé** : taille fournie par `/api/ps` d'Ollama, affichée séparément en GiB. Elle ne remplace pas une mesure du pic réel de mémoire unifiée MLX ; ne pas additionner `size` et `size_vram` sur Apple Silicon.
- **Environnement** : les informations du navigateur peuvent être approximatives ; le backend complète la détection matérielle.

Pour comparer des tests, gardez les mêmes prompts et paramètres, et indiquez le matériel ainsi que le runner utilisé.

[Architecture de l'application](TECHNICAL_README.md) · [Détails RAM et GPU](BACKEND_README.md)

---

## 📝 Export des résultats

### Format du rapport Markdown

Le rapport généré contient :

1. **En-tête** : date et version de l'outil.
2. **Environnement** : configuration et inventaire Apple détecté avec provenance, lorsque disponible.
3. **Résumé** : tokens, débit moyen, TTFT, durée, source mémoire, pic/moyenne en MiB et modèle chargé en GiB.
4. **JSON communautaire v1** : paramètres, mesures et environnement, sans prompts, réponses ni clés API dans ce bloc.
5. **Détails** : métriques, prompt et réponse de chaque test.

Le débit moyen correspond aux tokens générés divisés par la durée totale du test.
La RSS cumulée et la taille du modèle déclarée par Ollama restent des mesures distinctes.
Une valeur inconnue est indiquée par **N/A** ; elle n'est pas remplacée par zéro.

Le rapport Markdown complet contient les prompts et réponses : vérifiez-le avant partage.
L'export actuel utilise `llm-benchmarker.community` **1.0.0** ; le
[schéma v2](schemas/README.md) prépare les collectes et benchmarks futurs, sans en être encore l'export actif.
L'envoi automatique vers le futur site communautaire n'est pas encore implémenté.

---

## 💾 Stockage

### localStorage

Toutes les données sont stockées localement dans le navigateur :

- **Résultats actuels** : Stockés dans la variable `state.results` (session)
- **Historique** : Stocké dans `localStorage` sous la clé `llm_bench_history` (jusqu'à 50 sessions)
- **Clés API** : Stockées dans `localStorage` sous la clé `llm_bench_keys`
- **Configuration RAM** : Backend non stocké (exécuté localement)

### Confidentialité

- **Runner local sur votre machine** : les prompts sont envoyés au serveur local sélectionné. Après installation et téléchargement du modèle, les tests locaux peuvent fonctionner sans internet.
- **API externe ou serveur distant personnalisé** : les prompts et les informations nécessaires à l'authentification sont envoyés à ce serveur. Leur traitement dépend du fournisseur.
- **Résultats et historique** : conservés dans le navigateur ; un export crée un fichier sur votre machine.
- **Clés API** : conservées dans `localStorage`, sans chiffrement applicatif. Utilisez un profil de navigateur de confiance.
- **Backend RAM** : fournit à l'interface des informations sur les processus et le matériel de la machine qui l'exécute.

---

## 📜 Licence

**Apache License 2.0**

Ce projet est distribué sous la licence [Apache License, Version 2.0](LICENSE).

© 2025 [NVNC](https://nvnc.fr)

Voir le fichier [LICENSE](LICENSE) pour le texte complet de la licence.

---

### Résumé de la licence Apache 2.0

✅ **Autorisé** :
- Utilisation commerciale
- Modification
- Distribution
- Utilisation dans des projets fermés

❌ **Interdit** :
- Utilisation des marques commerciales sans autorisation
- Retirer les mentions de copyright

⚖️ **Obligations** :
- Inclure une copie de la licence
- Conserver les notices de copyright
- Indiquer les modifications apportées

---

## 🤝 Contribuer

Les contributions sont les bienvenues !

### Comment contribuer

1. **Forker** le dépôt
2. **Créer une branche** (`git checkout -b feature/amazing-feature`)
3. **Commiter** vos changements (`git commit -m 'feat: add amazing feature'`)
4. **Pousser** vers la branche (`git push origin feature/amazing-feature`)
5. **Ouvrir une Pull Request**

### Conventions de code

- **Commits** : Utilisez des messages clairs (`feat:`, `fix:`, `refactor:`, `docs:`)
- **Architecture** : Respectez la séparation en modules (core, ui, utils, config)
- **Noms de fichiers** : Utilisez le kebab-case (`my-module.js`)
- **Commentaires** : Documentez les fonctions et sections complexes

### Suggestions d'améliorations

- [ ] Support de plus de runners locaux (VLLM, Kobold, etc.)
- [ ] Benchmark comparatif entre plusieurs modèles
- [ ] Graphiques de visualisation des résultats (Chart.js, etc.)
- [ ] Export en JSON/CSV
- [ ] Tests automatisés (Jest, Cypress)
- [ ] Interface en anglais
- [ ] Thème sombre/clair
- [ ] Migration vers ES6 modules
- [ ] Intégration avec Prometheus/Grafana pour le monitoring

### 📖 Documentation technique
Pour les améliorations futures et la roadmap détaillée, consultez :
- **[innovation.md](innovation.md)** - Roadmap des fonctionnalités multi-GPU et cluster

---

## ⚠️ Limitations connues

### Version v0.06

- **CORS** : Nécessite un serveur web local pour fonctionner (pas de `file://`)
- **Streaming** : Seule Ollama supporte le streaming pour la mesure du TTFT
- **Modèles lourds** : Peut être lent avec des modèles > 30B paramètres
- **APIs externes** : Nécessite une clé API valide
- **Browser support** : Testé sur Chrome, Firefox, Safari (Edge partiel)
- **Monitoring RAM** : Uniquement disponible pour Ollama avec le backend Node.js
- **Détection GPU** : La détection multi-GPU (NVIDIA/AMD/Intel) nécessite le backend Node.js

### Problèmes connus

| Problème | Solution |
|----------|----------|
| Liste des modèles vide | Vérifiez que le runner est lancé et accessible |
| Erreur CORS | Servez le fichier via un serveur web local |
| Timeout sur modèles >30B (ex: gemma4:31b) | **Fixé en v0.06** - Timeout augmenté à 3 min pour Ollama |
| Clé API invalide | Vérifiez votre clé dans les paramètres |
| RAM affichée comme N/A | **Fixé en v0.06** - Bug corrigé : `peakMemory = 0` bloquait l'affichage |
| Backend non détecté (faux négatif) | **Fixé en v0.06** - Détection améliorée avec `/api/ping` + timeout augmenté à 5s |
| Backend non détecté | Vérifiez que le backend tourne sur `localhost:3001` |

### Dépannage du monitoring RAM

**Backend non détecté** :
```bash
# Vérifiez que le backend est lancé
curl http://localhost:3001/

# Vérifiez qu'Ollama est lancé
ps aux | grep ollama
# ou
ollama list
```

**performance.memory non disponible** :
- Utilisez Chrome avec le flag `--enable-precision-memory-info`
- Pour suivre Ollama, lancez le backend Node.js ; le tas JavaScript de Chrome ne mesure pas la RAM du modèle.

---

## 📞 Support

Pour toute question ou problème :

1. Vérifiez la section [Limitations connues](#️-limitations-connues)
2. Consultez les logs du navigateur (F12 → Console)
3. Assurez-vous que votre runner local est bien lancé
4. Pour le monitoring RAM, vérifiez que le backend est en cours d'exécution

---

## 🏆 Remerciements

- [Ollama](https://ollama.com) - Pour les modèles locaux
- [LM Studio](https://lmstudio.ai) - Pour l'interface utilisateur
- [llama.cpp](https://github.com/ggerganov/llama.cpp) - Pour l'inference efficace
- [OpenAI](https://openai.com) - Pour les APIs de référence
- [Mistral AI](https://mistral.ai) - Pour les modèles ouverts
- [Anthropic](https://anthropic.com) - Pour Claude
- [Google](https://ai.google.com) - Pour **Gemini** ✨

---

## Précautions d'utilisation

En téléchargeant ou en utilisant LLM Benchmarker, vous reconnaissez avoir pris connaissance
des informations du projet et de sa [charte d'utilisation](CHARTE_UTILISATION.md).

Les tests et leur historique sont consultables dans le navigateur ; les données conservées
localement et les exports peuvent être accessibles en clair. Veillez à ne pas y inclure
d'informations sensibles et à vérifier vos rapports avant de les partager. Si vous choisissez
une API externe, les données nécessaires au test sont transmises au fournisseur sélectionné.

Le logiciel est proposé gratuitement sous [licence Apache 2.0](LICENSE), avec les conditions
de garantie et de responsabilité qu'elle prévoit.

---

<div align="center">
  <p>
    <strong>LLM Benchmarker v0.06</strong> - Développé avec ❤️ par [NVNC](https://nvnc.fr) pour la communauté LLM
  </p>
</div>
