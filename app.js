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
    tab: 'calendrier',
    showPassword: false,
    isAuthenticated: false,
    loginEmail: '',
    loginPassword: '',
    loginError: '',
    currentYear: new Date().getFullYear(),
    calendarMonths: [],
    reservations: [],
    donnees: {},
    comptaData: {},
    
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

    get comptaYearData() {
      return this.comptaData[String(this.currentYear)] || {};
    },

    get comptaMetrics() {
      const yr = String(this.currentYear);
      const yearRes = this.reservations.filter(r => r.dateDebut && r.dateDebut.startsWith(yr));
      
      const nbMenages = yearRes.filter(r => String(r.forceMenageNon).toLowerCase().trim() !== 'oui').length;
      const menageEnPlus = Number(this.comptaYearData.menageEnPlus) || 0;
      const totalMenagesConciergerie = nbMenages + menageEnPlus;
      
      const nbRemiseCles = yearRes.filter(r => String(r.codeTarif).toLowerCase().trim() !== 'perso' && String(r.origine).toLowerCase().trim() !== 'perso').length;
      
      const totalMenageEuros = totalMenagesConciergerie * (Number(this.donnees.prixReelMenage) || 60);
      const totalRemiseClesEuros = nbRemiseCles * (Number(this.donnees.prixRemiseCle) || 60);
      const coutTotalConciergerie = totalMenageEuros + totalRemiseClesEuros;
      
      const paiementsRecus = (Number(this.comptaYearData.paiementConciergerie1) || 0) + 
                             (Number(this.comptaYearData.paiementConciergerie2) || 0) + 
                             (Number(this.comptaYearData.paiementConciergerie3) || 0) + 
                             (Number(this.comptaYearData.paiementConciergerie4) || 0);
                             
      const resteARecevoir = Math.max(0, coutTotalConciergerie - paiementsRecus);
      
      return { totalMenagesConciergerie, totalMenageEuros, nbRemiseCles, totalRemiseClesEuros, coutTotalConciergerie, paiementsRecus, resteARecevoir };
    },

    formatCurrency(val) { return (Number(val) || 0).toFixed(2) + ' €'; },
    formatDate(dStr) { return !dStr ? '' : `${dStr.split('-')[2]}/${dStr.split('-')[1]}/${dStr.split('-')[0]}`; },
    calcNights(start, end) { return (!start || !end) ? 0 : Math.max(0, Math.round((new Date(end.split('-')[0], end.split('-')[1] - 1, end.split('-')[2]) - new Date(start.split('-')[0], start.split('-')[1] - 1, start.split('-')[2])) / (1000 * 60 * 60 * 24))); },

    // --- EXPORT PDF INSTANTANÉ AVEC TEXTE CENTRÉ ---
    printPlanning() {
      const nomC = (this.donnees && this.donnees.nomConciergerie) ? this.donnees.nomConciergerie.trim() : 'Conciergerie';
      const fileName = `Planning-Conciergerie-${nomC}-${this.currentYear}`;

      const rows = this.getPlanningConciergerieData();
      let rowsHtml = '';
      
      rows.forEach(r => {
        const bgStyle = !r.res ? 'background-color: #ffffff;' : (r.isNonStandard ? 'background-color: #cbd5e1;' : 'background-color: #f1f5f9;');
        const clientName = r.res ? `${r.res.nom} ${r.res.prenom || ''}` : '-';
        const tel = r.res ? (r.res.telephone || '') : '';
        const pays = r.res ? (r.res.pays || '') : '';
        const kit = r.kitBebe || '-';
        
        const styleRemise = (r.remiseCle === 'Oui') ? 'color: #047857; font-weight: bold;' : 'color: #334155;';
        const styleMenage = (r.menage === 'Oui') ? 'color: #047857; font-weight: bold;' : 'color: #334155;';

        rowsHtml += `
          <tr style="${bgStyle}">
            <td style="border: 1px solid #94a3b8; padding: 2px 4px; font-weight: bold; text-align: center; white-space: nowrap;">${r.periodeAffichee}</td>
            <td style="border: 1px solid #94a3b8; padding: 2px 4px; text-align: center; font-weight: bold;">${r.nbNuits}</td>
            <td style="border: 1px solid #94a3b8; padding: 2px 4px; font-weight: 600; text-align: center;">${clientName}</td>
            <td style="border: 1px solid #94a3b8; padding: 2px 4px; text-align: center;">${tel}</td>
            <td style="border: 1px solid #94a3b8; padding: 2px 4px; text-align: center;">${pays}</td>
            <td style="border: 1px solid #94a3b8; padding: 2px 4px; text-align: center; font-weight: bold; color: #334155;">${kit}</td>
            <td style="border: 1px solid #94a3b8; padding: 2px 4px; text-align: center; text-transform: uppercase; ${styleRemise}">${r.remiseCle}</td>
            <td style="border: 1px solid #94a3b8; padding: 2px 4px; text-align: center; text-transform: uppercase; ${styleMenage}">${r.menage}</td>
          </tr>
        `;
      });

      const fullHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <title>${fileName}</title>
          <style>
            @page { size: landscape; margin: 5mm; }
            body { font-family: system-ui, -apple-system, sans-serif; margin: 0; padding: 0; background: white; color: black; }
            * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
            table th, table td { text-align: center !important; }
          </style>
        </head>
        <body>
          <div style="background-color: #0f172a; color: white; text-align: center; padding: 8px; border-radius: 6px; margin-bottom: 8px;">
            <h1 style="font-size: 11px; font-weight: bold; text-transform: uppercase; margin: 0; letter-spacing: 1px;">
              CALENDRIER ROCHER SAINT PIERRE 1H - ${nomC.toUpperCase()} - ${this.currentYear}
            </h1>
          </div>
          <table style="width: 100%; border-collapse: collapse; font-size: 9px; text-align: center;">
            <thead>
              <tr style="background-color: #1e293b; color: white; text-transform: uppercase; font-size: 9px;">
                <th style="border: 1px solid #94a3b8; padding: 4px; text-align: center;">Période</th>
                <th style="border: 1px solid #94a3b8; padding: 4px; text-align: center;">Nuits</th>
                <th style="border: 1px solid #94a3b8; padding: 4px; text-align: center;">Client</th>
                <th style="border: 1px solid #94a3b8; padding: 4px; text-align: center;">Téléphone</th>
                <th style="border: 1px solid #94a3b8; padding: 4px; text-align: center;">Pays</th>
                <th style="border: 1px solid #94a3b8; padding: 4px; text-align: center;">Kit Bébé</th>
                <th style="border: 1px solid #94a3b8; padding: 4px; text-align: center;">Remise Clé</th>
                <th style="border: 1px solid #94a3b8; padding: 4px; text-align: center;">Ménage</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>
          <div style="margin-top: 8px; display: flex; justify-content: space-between; align-items: flex-start; font-size: 8px;">
            <table style="border-collapse: collapse; border: 1px solid #94a3b8; font-weight: bold;">
              <tr>
                <td style="border: 1px solid #94a3b8; padding: 2px 6px; text-transform: uppercase; background-color: #f8fafc; text-align: center;">Électricien</td>
                <td style="border: 1px solid #94a3b8; padding: 2px 6px; text-align: center;">Fabien COSTA</td>
                <td style="border: 1px solid #94a3b8; padding: 2px 6px; text-align: center;">06.63.98.53.38</td>
              </tr>
              <tr>
                <td style="border: 1px solid #94a3b8; padding: 2px 6px; text-transform: uppercase; background-color: #f8fafc; text-align: center;">Plombier</td>
                <td style="border: 1px solid #94a3b8; padding: 2px 6px; text-align: center;">William LAURENT</td>
                <td style="border: 1px solid #94a3b8; padding: 2px 6px; text-align: center;">06.67.32.38.44</td>
              </tr>
            </table>
            <div style="border: 1px solid #94a3b8; padding: 4px; background-color: white;">
              <div style="display: flex; align-items: center; margin-bottom: 2px;">
                <span style="width: 10px; height: 10px; background-color: #f1f5f9; border: 1px solid #94a3b8; display: inline-block; margin-right: 6px;"></span>
                <span style="font-weight: bold;">Semaine classique (samedi / samedi)</span>
              </div>
              <div style="display: flex; align-items: center;">
                <span style="width: 10px; height: 10px; background-color: #cbd5e1; border: 1px solid #94a3b8; display: inline-block; margin-right: 6px;"></span>
                <span style="font-weight: bold;">Court séjour / Date atypique</span>
              </div>
            </div>
          </div>
        </body>
        </html>
      `;

      let iframe = document.getElementById('print-iframe');
      if (!iframe) {
        iframe = document.createElement('iframe');
        iframe.id = 'print-iframe';
        iframe.style.position = 'fixed';
        iframe.style.right = '0';
        iframe.style.bottom = '0';
        iframe.style.width = '0';
        iframe.style.height = '0';
        iframe.style.border = '0';
        document.body.appendChild(iframe);
      }

      const doc = iframe.contentWindow.document;
      doc.open();
      doc.write(fullHtml);
      doc.close();

      setTimeout(() => {
        iframe.contentWindow.focus();
        iframe.contentWindow.print();
      }, 50);
    },

    getPlanningConciergerieData() {
      const yr = this.currentYear;
      let d = new Date(yr, 0, 1);
      d.setDate(d.getDate() - 15);
      
      while (d.getDay() !== 6) d.setDate(d.getDate() - 1);
      
      const endYear = new Date(yr, 11, 31);
      const rows = [];
      const sortedRes = [...this.reservations].sort((a,b) => a.dateDebut.localeCompare(b.dateDebut));
      
      while (d <= endYear) {
        const startISO = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        let currentRes = sortedRes.find(r => r.dateDebut <= startISO && r.dateFin > startISO);
        
        if (currentRes) {
          const [y1, m1, d1] = currentRes.dateDebut.split('-').map(Number);
          const [y2, m2, d2] = currentRes.dateFin.split('-').map(Number);
          const isNonStandard = new Date(y1, m1 - 1, d1).getDay() !== 6 || new Date(y2, m2 - 1, d2).getDay() !== 6;

          rows.push({
            id: 'res_' + currentRes.id + '_' + startISO,
            periodeAffichee: `Du ${this.formatDate(currentRes.dateDebut)} au ${this.formatDate(currentRes.dateFin)}`,
            nbNuits: this.calcNights(currentRes.dateDebut, currentRes.dateFin),
            res: currentRes,
            kitBebe: currentRes.kitBebe === 'oui' ? 'Oui' : 'Non',
            remiseCle: this.isPerso(currentRes) ? 'Non' : 'Oui',
            menage: currentRes.forceMenageNon === 'oui' ? 'Non' : 'Oui',
            isNonStandard: isNonStandard
          });
          const [y, m, day] = currentRes.dateFin.split('-').map(Number);
          d = new Date(y, m - 1, day);
        } else {
          let nextRes = sortedRes.find(r => r.dateDebut > startISO);
          let nextSat = new Date(d);
          nextSat.setDate(nextSat.getDate() + 1);
          while (nextSat.getDay() !== 6) nextSat.setDate(nextSat.getDate() + 1);
          let endFree = nextSat;
          
          if (nextRes) {
            const [ny, nm, nd] = nextRes.dateDebut.split('-').map(Number);
            const nextResStart = new Date(ny, nm - 1, nd);
            if (nextResStart < endFree) endFree = nextResStart;
          }
          const endFreeISO = `${endFree.getFullYear()}-${String(endFree.getMonth() + 1).padStart(2, '0')}-${String(endFree.getDate()).padStart(2, '0')}`;
          
          rows.push({
            id: 'free_' + startISO,
            periodeAffichee: `Du ${this.formatDate(startISO)} au ${this.formatDate(endFreeISO)}`,
            nbNuits: '',
            res: null,
            kitBebe: '-',
            remiseCle: '-',
            menage: '-',
            isNonStandard: false
          });
          d = endFree;
        }
      }
      return rows;
    },

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
