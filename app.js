// --- CONFIGURATION FIREBASE ---
const firebaseConfig = {
  apiKey: "AIzaSyDVvRxbKqlck7-V5uDZcsGqYXx7rEmMt4g",
  authDomain: "rochersaintpierre1h.firebaseapp.com",
  projectId: "rochersaintpierre1h",
  storageBucket: "rochersaintpierre1h.firebasestorage.app",
  messagingSenderId: "12413486620",
  appId: "1:12413486620:web:baede780cf1e204dc681d9"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

function app() {
  return {
    tab: 'calendrier', // Nouvel onglet par défaut
    showPassword: false, // Gestion de l'oeil du mot de passe
    isAuthenticated: false,
    loginEmail: '',
    loginPassword: '',
    loginError: '',
    currentYear: new Date().getFullYear(),
    calendarMonths: [],
    reservations: [],
    donnees: {},
    comptaData: {}, // Ajout pour stocker la comptabilité issue du Mac
    
    // Variables pour la fiche client
    showModalClient: false,
    selectedRes: null,

    initData() {
      firebase.auth().onAuthStateChanged((user) => {
        if (user) {
          this.isAuthenticated = true;
          this.loadFirebaseData();
        } else {
          this.isAuthenticated = false;
        }
      });
      this.$nextTick(() => {
        if (window.lucide) window.lucide.createIcons();
      });
    },

    login() {
      this.loginError = '';
      firebase.auth().signInWithEmailAndPassword(this.loginEmail, this.loginPassword)
        .catch((error) => { this.loginError = "Email ou mot de passe incorrect."; });
    },

    logout() {
      firebase.auth().signOut();
    },

    changeGlobalYear(delta) {
      this.currentYear += delta;
      this.renderCalendar();
    },

    loadFirebaseData() {
      db.collection("locations").doc("rocher1H").onSnapshot((doc) => {
        if (doc.exists) {
          if (doc.data().donnees) this.donnees = doc.data().donnees;
          // Récupération des données comptables enregistrées par l'appli Mac
          if (doc.data().comptaData) this.comptaData = doc.data().comptaData; 
          this.renderCalendar();
        }
      });

      db.collection("locations").doc("rocher1H").collection("reservations").onSnapshot((snapshot) => {
        const resas = [];
        snapshot.forEach((doc) => resas.push(doc.data()));
        this.reservations = resas;
        this.renderCalendar();
      });
    },

    // --- CALCULS COMPTABILITÉ CONCIERGERIE ---
    get comptaYearData() {
      return this.comptaData[String(this.currentYear)] || {};
    },

    get comptaMetrics() {
      const yr = String(this.currentYear);
      // Récupérer les résas de l'année
      const yearRes = this.reservations.filter(r => r.dateDebut && r.dateDebut.startsWith(yr));
      
      // Calcul Ménages
      const nbMenages = yearRes.filter(r => String(r.forceMenageNon).toLowerCase().trim() !== 'oui').length;
      const menageEnPlus = Number(this.comptaYearData.menageEnPlus) || 0;
      const totalMenagesConciergerie = nbMenages + menageEnPlus;
      
      // Calcul Remises clés (Hors perso/black)
      const nbRemiseCles = yearRes.filter(r => String(r.codeTarif).toLowerCase().trim() !== 'perso' && String(r.origine).toLowerCase().trim() !== 'perso').length;
      
      // Totaux en Euros
      const totalMenageEuros = totalMenagesConciergerie * (Number(this.donnees.prixReelMenage) || 60);
      const totalRemiseClesEuros = nbRemiseCles * (Number(this.donnees.prixRemiseCle) || 60);
      const coutTotalConciergerie = totalMenageEuros + totalRemiseClesEuros;
      
      // Paiements reçus (4 cases)
      const paiementsRecus = (Number(this.comptaYearData.paiementConciergerie1) || 0) + 
                             (Number(this.comptaYearData.paiementConciergerie2) || 0) + 
                             (Number(this.comptaYearData.paiementConciergerie3) || 0) + 
                             (Number(this.comptaYearData.paiementConciergerie4) || 0);
                             
      // Reste à recevoir
      const resteARecevoir = Math.max(0, coutTotalConciergerie - paiementsRecus);
      
      return {
        totalMenagesConciergerie,
        totalMenageEuros,
        nbRemiseCles,
        totalRemiseClesEuros,
        coutTotalConciergerie,
        paiementsRecus,
        resteARecevoir
      };
    },

    formatCurrency(val) { 
      return (Number(val) || 0).toFixed(2) + ' €'; 
    },
    formatDate(dStr) { 
      return !dStr ? '' : `${dStr.split('-')[2]}/${dStr.split('-')[1]}/${dStr.split('-')[0]}`; 
    },
    // ------------------------------------------

    isPerso(res) {
      if (!res) return false;
      const fullName = (res.nom + ' ' + (res.prenom || '')).toLowerCase().trim();
      const reverseName = ((res.prenom || '') + ' ' + res.nom).toLowerCase().trim();
      return fullName === 'indispo perso' || reverseName === 'indispo perso';
    },

    getReservationStatus(res) {
      if (!res) return 'option';
      if (this.isPerso(res)) return 'confirme';
      if (res.codeTarif === 'booking' || res.origine === 'booking') return 'confirme';
      return ((Number(res.acompte) || 0) > 0 || (Number(res.soldePaye) || 0) > 0) ? 'confirme' : 'option';
    },

    isDateClosed(dateStr) {
      if (!this.donnees.fermetures) return false;
      return this.donnees.fermetures.some(f => f.debut && f.fin && dateStr >= f.debut && dateStr <= f.fin);
    },

    getColorForRes(res, isClosed) {
      if (isClosed) return '#e2e8f0'; 
      if (!res) return 'rgba(52, 211, 153, 0.3)'; 
      if (this.isPerso(res)) return 'rgba(96, 165, 250, 0.4)'; 
      if (this.getReservationStatus(res) === 'option') return 'rgba(251, 191, 36, 0.4)'; 
      return 'rgba(248, 113, 113, 0.4)'; 
    },

    getDayTooltip(day) {
      if (day.isClosed) return 'Fermé';
      if (!day.resMatin && !day.resAprem) return 'Libre';
      
      if (day.resMatin && day.resAprem && day.resMatin.id === day.resAprem.id) {
        const res = day.resMatin;
        const statut = this.isPerso(res) ? 'Perso' : (this.getReservationStatus(res) === 'confirme' ? 'Confirmé' : 'Option');
        return `${statut} : ${res.nom} ${res.prenom || ''}`;
      }
      
      let tMatin = day.resMatin ? `${this.isPerso(day.resMatin) ? 'Perso' : day.resMatin.nom}` : 'Libre';
      let tAprem = day.resAprem ? `${this.isPerso(day.resAprem) ? 'Perso' : day.resAprem.nom}` : 'Libre';
      return `Matin (Départ) : ${tMatin} \nAprem (Arrivée) : ${tAprem}`;
    },

    openClientCard(day) {
      if (day.isClosed) return; 
      const res = day.resAprem || day.resMatin; 
      if (res) {
        this.selectedRes = res;
        this.showModalClient = true;
      }
    },

    renderCalendar() {
      const months = [];
      for (let m = 0; m < 12; m++) {
        const date = new Date(this.currentYear, m, 1);
        let firstDayIndex = date.getDay() - 1;
        if (firstDayIndex === -1) firstDayIndex = 6;
        const daysArr = [];
        for (let d = 1; d <= new Date(this.currentYear, m + 1, 0).getDate(); d++) {
          const currentDayStr = `${this.currentYear}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
          const resMatin = this.reservations.find(r => currentDayStr > r.dateDebut && currentDayStr <= r.dateFin);
          const resAprem = this.reservations.find(r => currentDayStr >= r.dateDebut && currentDayStr < r.dateFin);
          const isClosed = this.isDateClosed(currentDayStr);
          
          daysArr.push({ dayNum: d, dateStr: currentDayStr, resMatin: resMatin || null, resAprem: resAprem || null, isClosed: isClosed });
        }
        months.push({ name: date.toLocaleString('fr-FR', { month: 'long' }), padding: firstDayIndex, days: daysArr });
      }
      this.calendarMonths = months;
    }
  }
}