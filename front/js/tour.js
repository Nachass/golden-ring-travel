class TourApp {
    constructor() {
        this.currentTour = null;
        this.currentUser = null;
        this.reviews = [];
        this.userReview = null;
        this.currentStep = 1;
        this.totalSteps = 3;
        this.bookingData = {};
        this.init();
    }

    init() {
        this.loadTheme();
        this.bindEvents();
        this.checkAuth();
        this.loadTourDetails();
    }

    loadTheme() {
        const savedTheme = localStorage.getItem('theme') || 'light';
        this.setTheme(savedTheme);
    }

    setTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        
        const themeToggle = document.getElementById('themeToggle');
        if (themeToggle) {
            themeToggle.textContent = theme === 'dark' ? 'Темная тема' : 'Светлая тема';
        }
    }

    bindEvents() {
        // Основные обработчики
        document.getElementById('finalSubmitBtn')?.addEventListener('click', () => this.handleBooking());
        
        // Делегирование событий
        document.addEventListener('click', (e) => {
            const target = e.target;
            
            // Кнопки счетчика
            if (target.classList.contains('counter-btn')) {
                e.preventDefault();
                const action = target.dataset.action;
                if (action === 'increase') this.increaseTickets();
                if (action === 'decrease') this.decreaseTickets();
                return;
            }
            
            // Кнопки навигации
            if (target.classList.contains('next-btn')) {
                e.preventDefault();
                const nextStep = parseInt(target.dataset.next);
                this.goToStep(nextStep);
                return;
            }
            
            if (target.classList.contains('back-btn')) {
                e.preventDefault();
                const prevStep = parseInt(target.dataset.back);
                this.goToStep(prevStep);
                return;
            }
            
            // Методы оплаты
            if (target.type === 'radio' && target.name === 'paymentMethod') {
                this.switchPaymentMethod(target.value);
                return;
            }
        });

        // Обработчики ввода
        document.getElementById('ticketCount')?.addEventListener('input', () => this.updateTotalPrice());
        document.getElementById('customerEmail')?.addEventListener('input', () => this.validateStep1());

        // Остальные обработчики
        document.getElementById('settingsBtn')?.addEventListener('click', () => this.showSettingsPopup());
        document.getElementById('themeToggle')?.addEventListener('click', () => this.toggleTheme());
        document.getElementById('adminLoginBtn')?.addEventListener('click', () => this.showAdminLoginPopup());
        document.getElementById('profileBtn')?.addEventListener('click', () => this.handleProfileClick());
        
        // Закрытие попапов
        document.querySelectorAll('.close').forEach(closeBtn => {
            closeBtn.addEventListener('click', (e) => {
                e.target.closest('.popup').style.display = 'none';
            });
        });

        window.addEventListener('click', (e) => {
            if (e.target.classList.contains('popup')) {
                e.target.style.display = 'none';
            }
        });

        // Форма отзывов
        document.addEventListener('submit', (e) => {
            if (e.target.id === 'reviewForm') {
                e.preventDefault();
                this.handleReviewSubmit(e);
            }
        });
    }

    handleProfileClick() {
        if (this.currentUser) {
            alert('Профиль пользователя - перейдите на главную страницу для управления профилем');
        } else {
            window.location.href = 'index.html';
        }
    }

    toggleTheme() {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'light' ? 'dark' : 'light';
        this.setTheme(newTheme);
        localStorage.setItem('theme', newTheme);
    }

    showSettingsPopup() {
        const popup = document.createElement('div');
        popup.className = 'popup';
        popup.style.display = 'block';
        popup.innerHTML = `
            <div class="popup-content">
                <span class="close">&times;</span>
                <h3>Настройки</h3>
                <div class="settings-options">
                    <label>
                        <input type="checkbox" id="themeCheckbox"> 
                        Темная тема
                    </label>
                    <button onclick="location.href='main.html'">Административный доступ</button>
                </div>
            </div>
        `;
        document.body.appendChild(popup);
        
        const checkbox = popup.querySelector('#themeCheckbox');
        checkbox.checked = document.documentElement.getAttribute('data-theme') === 'dark';
        checkbox.addEventListener('change', (e) => this.toggleTheme());
        
        popup.querySelector('.close').addEventListener('click', () => {
            popup.style.display = 'none';
        });
    }

    showAdminLoginPopup() {
        const popup = document.createElement('div');
        popup.className = 'popup';
        popup.style.display = 'block';
        popup.innerHTML = `
            <div class="popup-content">
                <span class="close">&times;</span>
                <h3>Вход для администратора</h3>
                <form id="adminLoginFormTemp">
                    <input type="text" name="username" placeholder="Логин" required>
                    <input type="password" name="password" placeholder="Пароль" required>
                    <button type="submit">Войти</button>
                </form>
            </div>
        `;
        document.body.appendChild(popup);
        
        popup.querySelector('#adminLoginFormTemp').addEventListener('submit', (e) => this.handleAdminLogin(e));
        popup.querySelector('.close').addEventListener('click', () => {
            popup.style.display = 'none';
        });
    }

    async handleAdminLogin(e) {
        e.preventDefault();
        const formData = new FormData(e.target);
        const username = formData.get('username');
        const password = formData.get('password');
        
        try {
            const response = await fetch('/api/admin/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ username, password })
            });

            const result = await response.json();
            if (result.success) {
                localStorage.setItem('adminToken', result.token);
                window.location.href = 'main.html';
            } else {
                this.showError(result.error || 'Неверный логин или пароль');
            }
        } catch (error) {
            this.showError('Ошибка соединения с сервером');
        }
    }

    async checkAuth() {
        const token = localStorage.getItem('token');
        if (token) {
            try {
                const response = await fetch('/api/user/profile', {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (response.ok) {
                    this.currentUser = await response.json();
                    this.updateProfileButton();
                }
            } catch (error) {
                console.error('Ошибка проверки авторизации:', error);
            }
        }
    }

    updateProfileButton() {
        const profileBtn = document.getElementById('profileBtn');
        if (this.currentUser && profileBtn) {
            const firstName = this.currentUser.full_name.split(' ')[0];
            profileBtn.textContent = firstName;
        }
    }

    async loadTourDetails() {
        const urlParams = new URLSearchParams(window.location.search);
        const tourId = urlParams.get('id');
        
        if (!tourId) {
            document.getElementById('tourDetails').innerHTML = '<div class="no-tours">Тур не найден</div>';
            return;
        }

        try {
            const response = await fetch(`/api/tour/${tourId}`);
            if (response.ok) {
                const tourData = await response.json();
                this.currentTour = tourData;
                this.renderTourDetails();
                this.loadReviews(tourId);
            } else {
                throw new Error('Тур не найден');
            }
        } catch (error) {
            console.error('Ошибка загрузки тура:', error);
            document.getElementById('tourDetails').innerHTML = '<div class="no-tours">Ошибка загрузки тура</div>';
        }
    }

    renderTourDetails() {
        const container = document.getElementById('tourDetails');
        if (!container) return;

        const tour = this.currentTour;

        container.innerHTML = `
            <div class="tour-detail-page">
                <div class="tour-header">
                    <h1 class="tour-title">${this.escapeHtml(tour.title)}</h1>
                    <div class="tour-price">${tour.price} ₽</div>
                </div>
                
                <div class="tour-meta">
                    <div class="tour-city">📍 ${this.escapeHtml(tour.city_name)}</div>
                    <div class="tour-duration">⏱️ ${tour.duration_days} дней</div>
                    <div class="tour-seats">🎫 Доступно мест: ${tour.available_seats}</div>
                    <div class="tour-rating">★ ${parseFloat(tour.rating || 0).toFixed(1)} (${tour.review_count || 0} отзывов)</div>
                </div>
                
                <div class="tour-description">
                    <h3>Описание</h3>
                    <p>${this.escapeHtml(tour.full_description || tour.description)}</p>
                </div>
                
                ${tour.image_url ? `
                <div class="tour-image">
                    <img src="${this.escapeHtml(tour.image_url)}" alt="${this.escapeHtml(tour.title)}" style="max-width: 100%; border-radius: 10px;">
                </div>
                ` : ''}
                
                <div class="tour-reviews">
                    <h3>Отзывы</h3>
                    <div id="reviewsList">
                        <div class="loading">Загрузка отзывов...</div>
                    </div>
                </div>
                
                <div class="tour-actions">
                    <button class="view-details-btn large" onclick="tourApp.openBookingPopup()">
                        🎫 Оформить заказ
                    </button>
                </div>
            </div>
        `;
    }

    async loadReviews(tourId) {
        try {
            const token = localStorage.getItem('token');
            const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
            
            const response = await fetch(`/api/tours/${tourId}/reviews`, { headers });
            
            if (response.ok) {
                const data = await response.json();
                this.reviews = data.reviews || [];
                this.userReview = data.userReview || null;
            } else {
                this.reviews = [];
                this.userReview = null;
            }
            
            this.renderReviews();
        } catch (error) {
            console.error('Ошибка загрузки отзывов:', error);
            this.reviews = [];
            this.userReview = null;
            this.renderReviews();
        }
    }

    renderReviews() {
        const container = document.getElementById('reviewsList');
        if (!container) return;
        
        let html = '';
        
        if (this.currentUser) {
            html += this.renderReviewForm();
        } else {
            html += '<div class="review-login-prompt">Войдите, чтобы оставить отзыв</div>';
        }
        
        const otherReviews = this.reviews.filter(review => 
            !this.userReview || review.id !== this.userReview.id
        );
        
        if (otherReviews.length > 0) {
            html += '<div class="reviews-section"><h4>Отзывы других путешественников:</h4>';
            html += otherReviews.map(review => this.renderReviewItem(review)).join('');
            html += '</div>';
        } else if (!this.currentUser) {
            html += '<div class="no-tours">Отзывов пока нет</div>';
        }
        
        container.innerHTML = html;
    }

    renderReviewForm() {
        const review = this.userReview;
        
        return `
            <div class="review-form-section">
                <h4>${review ? 'Ваш отзыв' : 'Оставить отзыв'}</h4>
                <form id="reviewForm" class="review-form">
                    <div class="rating-selector">
                        <label>Оценка:</label>
                        <select name="rating" required>
                            <option value="5" ${review && review.rating === 5 ? 'selected' : ''}>★ ★ ★ ★ ★ (5)</option>
                            <option value="4" ${review && review.rating === 4 ? 'selected' : ''}>★ ★ ★ ★ ☆ (4)</option>
                            <option value="3" ${review && review.rating === 3 ? 'selected' : ''}>★ ★ ★ ☆ ☆ (3)</option>
                            <option value="2" ${review && review.rating === 2 ? 'selected' : ''}>★ ★ ☆ ☆ ☆ (2)</option>
                            <option value="1" ${review && review.rating === 1 ? 'selected' : ''}>★ ☆ ☆ ☆ ☆ (1)</option>
                        </select>
                    </div>
                    <textarea name="comment" placeholder="Ваш отзыв..." required>${review ? this.escapeHtml(review.comment) : ''}</textarea>
                    <div class="review-actions">
                        <button type="submit">${review ? 'Обновить отзыв' : 'Оставить отзыв'}</button>
                        ${review ? '<button type="button" onclick="tourApp.deleteReview()" class="delete-btn">Удалить отзыв</button>' : ''}
                    </div>
                </form>
            </div>
        `;
    }

    renderReviewItem(review) {
        return `
            <div class="review-item">
                <div class="review-header">
                    <div class="review-author">${this.escapeHtml(review.user_name)}</div>
                    <div class="review-rating">★ ${review.rating}.0</div>
                </div>
                <div class="review-comment">${this.escapeHtml(review.comment)}</div>
                <div class="review-date">${new Date(review.created_at).toLocaleDateString('ru-RU')}</div>
            </div>
        `;
    }

    async handleReviewSubmit(e) {
        const formData = new FormData(e.target);
        const reviewData = {
            rating: parseInt(formData.get('rating')),
            comment: formData.get('comment')
        };

        try {
            const token = localStorage.getItem('token');
            const method = this.userReview ? 'PUT' : 'POST';
            const url = this.userReview 
                ? `/api/tours/${this.currentTour.id}/reviews/${this.userReview.id}`
                : `/api/tours/${this.currentTour.id}/reviews`;

            const response = await fetch(url, {
                method: method,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(reviewData)
            });

            if (response.ok) {
                await this.loadReviews(this.currentTour.id);
                this.showSuccess(this.userReview ? 'Отзыв обновлен!' : 'Отзыв добавлен!');
            } else {
                const errorData = await response.json();
                this.showError(errorData.error || 'Ошибка сохранения отзыва');
            }
        } catch (error) {
            console.error('Ошибка:', error);
            this.showError('Ошибка соединения с сервером');
        }
    }

    async deleteReview() {
        if (!confirm('Удалить ваш отзыв?')) return;

        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`/api/tours/${this.currentTour.id}/reviews/${this.userReview.id}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.ok) {
                await this.loadReviews(this.currentTour.id);
                this.showSuccess('Отзыв удален!');
            } else {
                const errorData = await response.json();
                this.showError(errorData.error || 'Ошибка удаления отзыва');
            }
        } catch (error) {
            console.error('Ошибка:', error);
            this.showError('Ошибка соединения с сервером');
        }
    }

    // ========== БРОНИРОВАНИЕ ==========

    openBookingPopup() {
        if (!this.currentUser) {
            this.showError('Для оформления заказа необходимо войти в систему');
            window.location.href = 'index.html';
            return;
        }

        if (!this.currentTour) {
            this.showError('Информация о туре не загружена');
            return;
        }

        const tour = this.currentTour;
        
        this.resetBookingForm();
        this.fillTourInfo(tour);
        this.setupTicketLimits(tour);
        this.updateTotalPrice();
        
        document.getElementById('bookingPopup').style.display = 'block';
    }

    resetBookingForm() {
        this.currentStep = 1;
        this.updateStepIndicator();
        this.bookingData = {};
        
        const ticketInput = document.getElementById('ticketCount');
        if (ticketInput) ticketInput.value = 1;
        
        const emailInput = document.getElementById('customerEmail');
        if (emailInput) emailInput.value = this.currentUser?.email || '';
        
        const cardInputs = ['cardNumber', 'cardExpiry', 'cardCVV', 'cardHolder'];
        cardInputs.forEach(id => {
            const input = document.getElementById(id);
            if (input) input.value = '';
        });
        
        const cardHolder = document.getElementById('cardHolder');
        if (cardHolder && this.currentUser) {
            cardHolder.value = this.currentUser.full_name || '';
        }
        
        const cardRadio = document.getElementById('paymentCard');
        if (cardRadio) cardRadio.checked = true;
        this.switchPaymentMethod('card');
    }

    fillTourInfo(tour) {
        const elements = {
            'bookingTourTitle': tour.title,
            'bookingTourCity': tour.city_name,
            'bookingTourDuration': `${tour.duration_days} дней`,
            'bookingTourPrice': `${tour.price} ₽`,
            'bookingTourSeats': tour.available_seats
        };

        Object.entries(elements).forEach(([id, value]) => {
            const element = document.getElementById(id);
            if (element) element.textContent = value;
        });
        
        const tourImage = document.getElementById('bookingTourImage');
        if (tourImage) {
            if (tour.image_url) {
                tourImage.src = tour.image_url;
                tourImage.style.display = 'block';
            } else {
                tourImage.style.display = 'none';
            }
        }
    }

    setupTicketLimits(tour) {
        const ticketInput = document.getElementById('ticketCount');
        if (!ticketInput) return;
        
        const maxTickets = Math.min(tour.available_seats, 10);
        ticketInput.max = maxTickets;
        
        const seatsElement = document.getElementById('bookingTourSeats');
        if (seatsElement) {
            seatsElement.textContent = `${tour.available_seats} мест доступно (макс. ${maxTickets} на заказ)`;
        }
    }

    increaseTickets() {
        const input = document.getElementById('ticketCount');
        if (!input) return;
        
        const max = parseInt(input.max);
        const current = parseInt(input.value);
        
        if (current < max) {
            input.value = current + 1;
            this.updateTotalPrice();
        } else {
            this.showError(`Максимальное количество билетов: ${max}`);
        }
    }

    decreaseTickets() {
        const input = document.getElementById('ticketCount');
        if (!input) return;
        
        const min = parseInt(input.min);
        const current = parseInt(input.value);
        
        if (current > min) {
            input.value = current - 1;
            this.updateTotalPrice();
        }
    }

    updateTotalPrice() {
        const ticketCount = parseInt(document.getElementById('ticketCount')?.value) || 0;
        const price = this.currentTour ? this.currentTour.price : 0;
        const subtotal = ticketCount * price;
        const serviceFee = Math.round(subtotal * 0.05);
        const totalPrice = subtotal + serviceFee;
        
        const priceElements = {
            'ticketsSubtotal': `${subtotal} ₽`,
            'serviceFee': `${serviceFee} ₽`,
            'totalPrice': `${totalPrice} ₽`
        };
        
        Object.entries(priceElements).forEach(([id, value]) => {
            const element = document.getElementById(id);
            if (element) element.textContent = value;
        });
    }

    switchPaymentMethod(method) {
        document.querySelectorAll('.payment-details').forEach(detail => {
            detail.classList.remove('active');
        });
        
        const activeDetails = document.querySelector(`.${method}-details`);
        if (activeDetails) {
            activeDetails.classList.add('active');
        }
        
        document.querySelectorAll('.payment-method').forEach(btn => {
            btn.classList.remove('active');
        });
        const activeMethod = document.querySelector(`.payment-method[data-method="${method}"]`);
        if (activeMethod) {
            activeMethod.classList.add('active');
        }
    }

    goToStep(step) {
        console.log(`Переход к шагу: ${step}`);
        
        // Валидация перед переходом
        if (step > this.currentStep) {
            if (!this.validateCurrentStep()) {
                return;
            }
        }
        
        this.currentStep = step;
        this.updateStepIndicator();
        
        // Если переходим к шагу 3, обновляем данные подтверждения
        if (step === 3) {
            this.updateConfirmationData();
        }
    }

    validateCurrentStep() {
        switch (this.currentStep) {
            case 1:
                return this.validateStep1();
            case 2:
                return this.validateStep2();
            default:
                return true;
        }
    }

    validateStep1() {
        const ticketCount = parseInt(document.getElementById('ticketCount')?.value) || 0;
        const email = document.getElementById('customerEmail')?.value || '';
        
        if (!ticketCount || ticketCount < 1) {
            this.showError('Укажите количество билетов');
            return false;
        }
        
        if (!this.validateEmail(email)) {
            this.showError('Введите корректный email');
            return false;
        }
        
        if (this.currentTour && ticketCount > this.currentTour.available_seats) {
            this.showError(`Недостаточно мест! Доступно: ${this.currentTour.available_seats}`);
            return false;
        }
        
        return true;
    }

    validateStep2() {
        const paymentMethod = document.querySelector('input[name="paymentMethod"]:checked')?.value;
        
        if (!paymentMethod) {
            this.showError('Выберите способ оплаты');
            return false;
        }
        
        if (paymentMethod === 'card') {
            return this.validateCardDetails();
        }
        
        return true;
    }

    validateCardDetails() {
        const cardNumber = document.getElementById('cardNumber')?.value.replace(/\s/g, '') || '';
        const cardExpiry = document.getElementById('cardExpiry')?.value || '';
        const cardCVV = document.getElementById('cardCVV')?.value || '';
        const cardHolder = document.getElementById('cardHolder')?.value || '';
        
        if (!this.validateCardNumber(cardNumber)) {
            this.showError('Введите корректный номер карты (13-19 цифр)');
            return false;
        }
        
        if (!this.validateExpiry(cardExpiry)) {
            this.showError('Введите корректный срок действия карты в формате ММ/ГГ');
            return false;
        }
        
        if (!/^\d{3}$/.test(cardCVV)) {
            this.showError('Введите корректный CVV код (3 цифры)');
            return false;
        }
        
        if (!cardHolder.trim()) {
            this.showError('Введите имя владельца карты');
            return false;
        }
        
        return true;
    }

    updateConfirmationData() {
        const bookingData = this.collectBookingData();
        
        const elements = {
            'confirmTourTitle': this.currentTour.title,
            'confirmTicketCount': `${bookingData.ticketCount} билет(ов)`,
            'confirmEmail': bookingData.customerEmail,
            'confirmPaymentMethod': bookingData.paymentMethod === 'card' ? 'Банковская карта' : 'СБП',
            'confirmTotalPrice': `${bookingData.totalPrice} ₽`
        };
        
        Object.entries(elements).forEach(([id, value]) => {
            const element = document.getElementById(id);
            if (element) element.textContent = value;
        });
    }

    updateStepIndicator() {
        console.log('Обновление индикатора шага:', this.currentStep);
        
        document.querySelectorAll('.step').forEach(step => {
            const stepNumber = parseInt(step.dataset.step);
            step.classList.toggle('active', stepNumber === this.currentStep);
        });
        
        document.querySelectorAll('.booking-step').forEach(step => {
            step.classList.remove('active');
        });
        
        const currentStepElement = document.getElementById(`step${this.currentStep}`);
        if (currentStepElement) {
            currentStepElement.classList.add('active');
        }
    }

    closeBookingPopup() {
        const popup = document.getElementById('bookingPopup');
        if (popup) popup.style.display = 'none';
        this.resetBookingForm();
    }

    async handleBooking() {
        console.log('Обработка бронирования');
        
        if (!this.validateCurrentStep()) {
            return;
        }

        const bookingData = this.collectBookingData();
        
        if (!this.validateBookingData(bookingData)) {
            return;
        }

        const submitBtn = document.getElementById('finalSubmitBtn');
        const originalText = submitBtn.textContent;
        submitBtn.textContent = 'Оформление...';
        submitBtn.disabled = true;

        try {
            const token = localStorage.getItem('token');
            const response = await fetch('/api/booking', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    tour_id: this.currentTour.id,
                    ticket_count: bookingData.ticketCount,
                    total_price: bookingData.totalPrice,
                    customer_email: bookingData.customerEmail
                })
            });

            const result = await response.json();

            if (result.success) {
                this.showSuccessPopup(result.alertMessage, result.bookingDetails);
                this.closeBookingPopup();
                await this.loadTourDetails();
            } else {
                this.showError(result.error || 'Ошибка оформления заказа');
            }
        } catch (error) {
            console.error('Ошибка оформления заказа:', error);
            this.showError('Ошибка соединения с сервером');
        } finally {
            submitBtn.textContent = originalText;
            submitBtn.disabled = false;
        }
    }

    collectBookingData() {
        const ticketCount = parseInt(document.getElementById('ticketCount')?.value) || 0;
        const price = this.currentTour.price;
        const subtotal = ticketCount * price;
        const serviceFee = Math.round(subtotal * 0.05);
        const totalPrice = subtotal + serviceFee;
        
        return {
            ticketCount: ticketCount,
            totalPrice: totalPrice,
            customerEmail: document.getElementById('customerEmail')?.value || '',
            paymentMethod: document.querySelector('input[name="paymentMethod"]:checked')?.value || 'card'
        };
    }

    validateBookingData(data) {
        if (!this.currentTour) {
            this.showError('Информация о туре не загружена');
            return false;
        }

        if (data.ticketCount > this.currentTour.available_seats) {
            this.showError(`Недостаточно мест! Доступно: ${this.currentTour.available_seats}`);
            return false;
        }

        if (data.ticketCount <= 0) {
            this.showError('Укажите корректное количество билетов');
            return false;
        }

        return true;
    }

    // Вспомогательные методы валидации
    validateEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    validateCardNumber(cardNumber) {
        const cleanNumber = cardNumber.replace(/\s/g, '');
        return /^\d{13,19}$/.test(cleanNumber);
    }

    validateExpiry(expiry) {
        const regex = /^(0[1-9]|1[0-2])\/(\d{2})$/;
        if (!regex.test(expiry)) return false;
        
        const [month, year] = expiry.split('/');
        const currentYear = new Date().getFullYear() % 100;
        const currentMonth = new Date().getMonth() + 1;
        
        if (parseInt(year) < currentYear) return false;
        if (parseInt(year) === currentYear && parseInt(month) < currentMonth) return false;
        
        return true;
    }

    showSuccessPopup(alertMessage, bookingDetails) {
        const successPopup = document.getElementById('successPopup');
        const successMessage = document.getElementById('successMessage');
        
        if (!successPopup || !successMessage) {
            this.showNotification('Заказ оформлен успешно!', 'success');
            return;
        }
        
        const formattedMessage = alertMessage
            .replace(/\n/g, '<br>')
            .replace(/✅/g, '')
            .replace(/🎫/g, '🎫 ')
            .replace(/📧/g, '📧 ')
            .replace(/🎟️/g, '🎟️ ')
            .replace(/💰/g, '💰 ');
        
        successMessage.innerHTML = formattedMessage;
        successPopup.style.display = 'block';
    }

    closeSuccessPopup() {
        const successPopup = document.getElementById('successPopup');
        if (successPopup) {
            successPopup.style.display = 'none';
        }
    }

    showSuccess(message) {
        this.showNotification(message, 'success');
    }

    showError(message) {
        this.showNotification(message, 'error');
    }

    showNotification(message, type = 'info') {
        document.querySelectorAll('.notification').forEach(n => n.remove());
        
        const notification = document.createElement('div');
        notification.className = 'notification';
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${type === 'success' ? 'var(--success-color)' : type === 'error' ? 'var(--danger-color)' : 'var(--primary-color)'};
            color: white;
            padding: 1rem 1.5rem;
            border-radius: 8px;
            z-index: 10000;
            max-width: 300px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.2);
            animation: slideIn 0.3s ease;
        `;
        notification.textContent = message;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => {
                if (notification.parentNode) {
                    document.body.removeChild(notification);
                }
            }, 300);
        }, 4000);
    }

    escapeHtml(unsafe) {
        if (!unsafe) return '';
        return unsafe
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }
}

const tourApp = new TourApp();