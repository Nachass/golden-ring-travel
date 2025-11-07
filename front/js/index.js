class TravelApp {
    constructor() {
        this.currentUser = null;
        this.cities = [];
        this.currentTheme = 'light';
        this.resetContact = null;
    }

    init() {
        this.loadTheme();
        this.bindEvents();
        this.checkAuth();
        this.loadCities();
    }

    loadTheme() {
        const savedTheme = localStorage.getItem('theme') || 'light';
        this.setTheme(savedTheme);
    }

    setTheme(theme) {
        this.currentTheme = theme;
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('theme', theme);
        
        const themeCheckbox = document.getElementById('themeCheckbox');
        const themeToggle = document.getElementById('themeToggle');
        
        if (themeCheckbox) {
            themeCheckbox.checked = theme === 'dark';
        }
        if (themeToggle) {
            themeToggle.textContent = theme === 'dark' ? 'Темная тема' : 'Светлая тема';
        }
    }

    bindEvents() {
        // Основные кнопки
        document.getElementById('settingsBtn').addEventListener('click', () => {
            this.showSettingsPopup();
        });

        document.getElementById('themeToggle').addEventListener('click', () => {
            this.toggleTheme();
        });

        document.getElementById('themeCheckbox').addEventListener('change', (e) => {
            this.setTheme(e.target.checked ? 'dark' : 'light');
        });

        document.getElementById('adminLoginBtn').addEventListener('click', () => {
            this.showAdminLoginPopup();
        });

        document.getElementById('adminAccessBtn').addEventListener('click', () => {
            this.showAdminLoginPopup();
        });

        document.getElementById('profileBtn').addEventListener('click', () => {
            if (this.currentUser) {
                this.showProfilePopup();
            } else {
                this.showAuthPopup();
            }
        });

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

        // Формы авторизации
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const tab = e.target.dataset.tab;
                this.switchAuthTab(tab);
            });
        });

        document.getElementById('loginForm').addEventListener('submit', (e) => this.handleLogin(e));
        document.getElementById('registerForm').addEventListener('submit', (e) => this.handleRegister(e));
        document.getElementById('adminLoginForm').addEventListener('submit', (e) => this.handleAdminLogin(e));
        
        // Восстановление пароля
        document.querySelector('.forgot-password').addEventListener('click', (e) => {
            e.preventDefault();
            this.showForgotPasswordPopup();
        });

        document.getElementById('forgotPasswordForm').addEventListener('submit', (e) => this.handleForgotPassword(e));
        document.getElementById('newPasswordForm').addEventListener('submit', (e) => this.handleNewPassword(e));
        
        this.bindProfileEvents();
    }

    bindProfileEvents() {
        document.getElementById('editProfileBtn').addEventListener('click', () => {
            this.showEditProfileForm();
        });
        
        document.getElementById('cancelEditBtn').addEventListener('click', () => {
            this.showProfileView();
        });
        
        document.getElementById('editProfileForm').addEventListener('submit', (e) => {
            this.handleEditProfile(e);
        });
        
        document.getElementById('changePasswordBtn').addEventListener('click', () => {
            this.showChangePasswordForm();
        });
        
        document.getElementById('cancelPasswordBtn').addEventListener('click', () => {
            this.showProfileView();
        });
        
        document.getElementById('passwordForm').addEventListener('submit', (e) => {
            this.handleChangePassword(e);
        });
        
        document.getElementById('logoutBtn').addEventListener('click', () => this.logout());
    }

    // Восстановление пароля
    showForgotPasswordPopup() {
        document.getElementById('forgotPasswordPopup').style.display = 'block';
        document.getElementById('forgotPasswordForm').reset();
    }

    async handleForgotPassword(e) {
        e.preventDefault();
        
        const contact = document.getElementById('resetContact').value.trim();
        
        if (!contact) {
            this.showError('Введите email или телефон');
            return;
        }

        const submitBtn = e.target.querySelector('button[type="submit"]');
        const originalText = submitBtn.textContent;
        submitBtn.textContent = 'Проверка...';
        submitBtn.disabled = true;

        try {
            const response = await fetch('/api/check-user', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ contact })
            });

            const result = await response.json();

            if (result.success) {
                this.resetContact = contact;
                document.getElementById('forgotPasswordPopup').style.display = 'none';
                this.showNewPasswordPopup();
            } else {
                this.showError(result.error || 'Пользователь не найден');
            }
        } catch (error) {
            console.error('Ошибка:', error);
            this.showError('Ошибка соединения с сервером');
        } finally {
            submitBtn.textContent = originalText;
            submitBtn.disabled = false;
        }
    }

    showNewPasswordPopup() {
        document.getElementById('newPasswordPopup').style.display = 'block';
        document.getElementById('newPasswordForm').reset();
    }

    closeNewPasswordPopup() {
        document.getElementById('newPasswordPopup').style.display = 'none';
        this.resetContact = null;
    }

    async handleNewPassword(e) {
        e.preventDefault();
        
        const newPassword = document.getElementById('newPasswordInput').value;
        const confirmPassword = document.getElementById('confirmPasswordInput').value;
        
        if (!newPassword || !confirmPassword) {
            this.showError('Заполните все поля');
            return;
        }
        
        if (newPassword !== confirmPassword) {
            this.showError('Пароли не совпадают');
            return;
        }
        
        if (newPassword.length < 6) {
            this.showError('Пароль должен быть не менее 6 символов');
            return;
        }

        const submitBtn = e.target.querySelector('button[type="submit"]');
        const originalText = submitBtn.textContent;
        submitBtn.textContent = 'Сохранение...';
        submitBtn.disabled = true;

        try {
            const response = await fetch('/api/reset-password', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    contact: this.resetContact,
                    newPassword: newPassword
                })
            });

            const result = await response.json();

            if (result.success) {
                this.closeNewPasswordPopup();
                this.showSuccess('Пароль успешно изменен! Теперь вы можете войти с новым паролем.');
                this.switchAuthTab('login');
            } else {
                this.showError(result.error || 'Ошибка смены пароля');
            }
        } catch (error) {
            console.error('Ошибка:', error);
            this.showError('Ошибка соединения с сервером');
        } finally {
            submitBtn.textContent = originalText;
            submitBtn.disabled = false;
        }
    }

    // Уведомления
    showSuccess(message) {
        this.showNotification(message, 'success');
    }

    showError(message) {
        this.showNotification(message, 'error');
    }

    showNotification(message, type = 'info') {
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

    closeSuccessPopup() {
        document.getElementById('successPopup').style.display = 'none';
    }

    // Основные методы
    toggleTheme() {
        const newTheme = this.currentTheme === 'light' ? 'dark' : 'light';
        this.setTheme(newTheme);
    }

    switchAuthTab(tab) {
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tab);
        });

        document.querySelectorAll('.auth-form').forEach(form => {
            form.classList.toggle('active', form.id === `${tab}Form`);
        });
    }

    async checkAuth() {
        const token = localStorage.getItem('token');
        if (token) {
            try {
                const response = await fetch('/api/user/profile', {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });

                if (response.ok) {
                    const userData = await response.json();
                    this.currentUser = userData;
                    this.updateProfileButton();
                } else {
                    localStorage.removeItem('token');
                }
            } catch (error) {
                console.error('Ошибка проверки авторизации:', error);
            }
        }
    }

    updateProfileButton() {
        const profileBtn = document.getElementById('profileBtn');
        if (this.currentUser) {
            const firstName = this.currentUser.full_name.split(' ')[0];
            profileBtn.textContent = firstName;
        } else {
            profileBtn.textContent = 'Войти';
        }
    }

    async loadCities() {
        try {
            const response = await fetch('/api/cities');
            if (response.ok) {
                this.cities = await response.json();
                this.renderCities();
            } else {
                throw new Error('Ошибка загрузки городов');
            }
        } catch (error) {
            console.error('Ошибка загрузки городов:', error);
            document.getElementById('citiesList').innerHTML = '<div class="no-tours">Ошибка загрузки данных</div>';
        }
    }

    renderCities() {
        const container = document.getElementById('citiesList');
        
        if (!container) {
            console.error('Элемент citiesList не найден');
            return;
        }
    
        if (this.cities.length === 0) {
            container.innerHTML = '<div class="no-tours">Города не найдены</div>';
            return;
        }
    
        // Сначала загружаем туры для расчета рейтингов
        this.loadCityRatings().then(cityRatings => {
            container.innerHTML = this.cities.map(city => {
                const rating = cityRatings[city.id] || 0;
                const ratingText = rating > 0 ? `★ ${rating.toFixed(1)}` : '★ Нет оценок';
                
                return `
                    <div class="city-card">
                        <div class="city-header">
                            <div class="city-name">${city.name}</div>
                            <div class="city-rating">
                                ${ratingText}
                            </div>
                        </div>
                        <div class="city-description">${city.description || 'Описание отсутствует'}</div>
                        <div class="tours-list" id="tours-${city.id}">
                            <button class="view-details-btn" onclick="travelApp.showCityTours(${city.id})">
                                Показать туры
                            </button>
                        </div>
                    </div>
                `;
            }).join('');
        }).catch(error => {
            console.error('Ошибка загрузки рейтингов:', error);
            // Отображаем города без рейтингов в случае ошибки
            this.renderCitiesWithoutRatings(container);
        });
    }
    
    // Добавьте новый метод для загрузки рейтингов городов:
    async loadCityRatings() {
        try {
            const response = await fetch('/api/tours');
            if (response.ok) {
                const tours = await response.json();
                const cityRatings = {};
                const cityReviewCounts = {};
                
                // Группируем туры по городам и считаем средний рейтинг
                tours.forEach(tour => {
                    if (!cityRatings[tour.city_id]) {
                        cityRatings[tour.city_id] = 0;
                        cityReviewCounts[tour.city_id] = 0;
                    }
                    
                    const tourRating = parseFloat(tour.rating) || 0;
                    const reviewCount = parseInt(tour.review_count) || 0;
                    
                    if (tourRating > 0) {
                        cityRatings[tour.city_id] += tourRating * reviewCount;
                        cityReviewCounts[tour.city_id] += reviewCount;
                    }
                });
                
                // Вычисляем средний рейтинг для каждого города
                Object.keys(cityRatings).forEach(cityId => {
                    const totalReviews = cityReviewCounts[cityId];
                    if (totalReviews > 0) {
                        cityRatings[cityId] = cityRatings[cityId] / totalReviews;
                    } else {
                        cityRatings[cityId] = 0;
                    }
                });
                
                return cityRatings;
            }
        } catch (error) {
            console.error('Ошибка загрузки рейтингов городов:', error);
        }
        return {};
    }
    
    // Добавьте метод для отображения без рейтингов (на случай ошибки):
    renderCitiesWithoutRatings(container) {
        container.innerHTML = this.cities.map(city => `
            <div class="city-card">
                <div class="city-header">
                    <div class="city-name">${city.name}</div>
                    <div class="city-rating">
                        ★ Нет оценок
                    </div>
                </div>
                <div class="city-description">${city.description || 'Описание отсутствует'}</div>
                <div class="tours-list" id="tours-${city.id}">
                    <button class="view-details-btn" onclick="travelApp.showCityTours(${city.id})">
                        Показать туры
                    </button>
                </div>
            </div>
        `).join('');
    }
    async showCityTours(cityId) {
        const container = document.getElementById(`tours-${cityId}`);
        
        if (!container) {
            console.error(`Контейнер tours-${cityId} не найден`);
            return;
        }

        try {
            const response = await fetch(`/api/tours/${cityId}`);
            if (response.ok) {
                const tours = await response.json();
                this.renderTours(cityId, tours);
            } else {
                throw new Error('Ошибка загрузки туров');
            }
        } catch (error) {
            console.error('Ошибка загрузки туров:', error);
            container.innerHTML = '<div class="no-tours">Ошибка загрузки туров</div>';
        }
    }

    renderTours(cityId, tours) {
        const container = document.getElementById(`tours-${cityId}`);
        
        if (!container) {
            console.error(`Контейнер tours-${cityId} не найден`);
            return;
        }

        if (tours.length === 0) {
            container.innerHTML = '<div class="no-tours">Туры пока не добавлены</div>';
            return;
        }

        container.innerHTML = tours.map(tour => {
            const rating = parseFloat(tour.rating) || 0;
            const reviewCount = parseInt(tour.review_count) || 0;
            
            return `
                <div class="tour-item">
                    <div class="tour-header">
                        <div class="tour-title">${tour.title}</div>
                        <div class="tour-price">${tour.price} ₽</div>
                    </div>
                    <div class="tour-description">${tour.description}</div>
                    <div class="tour-details">
                        <div class="tour-rating">
                            ★ ${rating.toFixed(1)} (${reviewCount} отзывов)
                        </div>
                        <div class="tour-duration">${tour.duration_days || 1} день</div>
                        <div class="tour-seats">🎫 ${tour.available_seats} мест</div>
                    </div>
                    <button class="view-details-btn" onclick="travelApp.showTourDetails(${tour.id})">
                        Подробнее
                    </button>
                </div>
            `;
        }).join('');
    }

    showTourDetails(tourId) {
        window.location.href = `tour.html?id=${tourId}`;
    }

    showAuthPopup() {
        const popup = document.getElementById('authPopup');
        if (popup) {
            popup.style.display = 'block';
            this.switchAuthTab('login');
        }
    }

    showProfilePopup() {
        const popup = document.getElementById('profilePopup');
        if (popup && this.currentUser) {
            document.getElementById('userName').textContent = this.currentUser.full_name;
            document.getElementById('userEmail').textContent = this.currentUser.email;
            document.getElementById('userPhone').textContent = this.currentUser.phone || 'Не указан';
            document.getElementById('userPassport').textContent = this.currentUser.passport || 'Не указан';
            
            this.showProfileView();
            popup.style.display = 'block';
        }
    }

    showProfileView() {
        document.getElementById('profileView').style.display = 'block';
        document.getElementById('profileEdit').style.display = 'none';
        document.getElementById('changePasswordForm').style.display = 'none';
    }

    showEditProfileForm() {
        document.getElementById('profileView').style.display = 'none';
        document.getElementById('profileEdit').style.display = 'block';
        document.getElementById('changePasswordForm').style.display = 'none';
        
        document.getElementById('editFullName').value = this.currentUser.full_name;
        document.getElementById('editEmail').value = this.currentUser.email;
        document.getElementById('editPhone').value = this.currentUser.phone || '';
        document.getElementById('editPassport').value = this.currentUser.passport || '';
    }

    showChangePasswordForm() {
        document.getElementById('profileView').style.display = 'none';
        document.getElementById('profileEdit').style.display = 'none';
        document.getElementById('changePasswordForm').style.display = 'block';
    }

    showSettingsPopup() {
        const popup = document.getElementById('settingsPopup');
        if (popup) {
            popup.style.display = 'block';
        }
    }

    showAdminLoginPopup() {
        document.getElementById('adminLoginPopup').style.display = 'block';
        document.getElementById('settingsPopup').style.display = 'none';
    }

    async handleLogin(e) {
        e.preventDefault();
        const formData = new FormData(e.target);
        const email = formData.get('email');
        const password = formData.get('password');
        
        if (!email || !password) {
            this.showError('Заполните все поля');
            return;
        }

        try {
            const response = await fetch('/api/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    email: email,
                    password: password
                })
            });

            const result = await response.json();

            if (result.success) {
                localStorage.setItem('token', result.token);
                this.currentUser = result.user;
                this.updateProfileButton();
                document.getElementById('authPopup').style.display = 'none';
                e.target.reset();
                this.showSuccess('Вход выполнен успешно!');
            } else {
                this.showError(result.error || 'Ошибка входа');
            }
        } catch (error) {
            this.showError('Ошибка соединения с сервером');
        }
    }

    async handleRegister(e) {
        e.preventDefault();
        const formData = new FormData(e.target);
        
        const userData = {
            full_name: formData.get('full_name'),
            email: formData.get('email'),
            phone: formData.get('phone'),
            passport: formData.get('passport'),
            password: formData.get('password')
        };

        for (let field in userData) {
            if (!userData[field]) {
                this.showError('Заполните все поля');
                return;
            }
        }

        const submitBtn = e.target.querySelector('button[type="submit"]');
        const originalText = submitBtn.textContent;
        submitBtn.textContent = 'Регистрация...';
        submitBtn.disabled = true;

        try {
            const response = await fetch('/api/register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(userData)
            });

            const result = await response.json();

            if (result.success) {
                this.showSuccess('Регистрация успешна! Теперь войдите в систему.');
                this.switchAuthTab('login');
                e.target.reset();
            } else {
                this.showError(result.error || 'Ошибка регистрации');
            }
        } catch (error) {
            this.showError('Ошибка соединения с сервером');
        } finally {
            submitBtn.textContent = originalText;
            submitBtn.disabled = false;
        }
    }

    async handleAdminLogin(e) {
        e.preventDefault();
        const formData = new FormData(e.target);
        const username = formData.get('username');
        const password = formData.get('password');
        
        if (!username || !password) {
            this.showError('Заполните все поля');
            return;
        }

        try {
            const response = await fetch('/api/admin/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    username: username,
                    password: password
                })
            });

            const result = await response.json();

            if (result.success) {
                localStorage.setItem('adminToken', result.token);
                window.location.href = 'main.html';
            } else {
                this.showError(result.error || 'Неверный логин или пароль');
            }
        } catch (error) {
            console.error('Request error:', error);
            this.showError('Ошибка соединения с сервером');
        }
    }

    async handleEditProfile(e) {
        e.preventDefault();
        
        const formData = {
            full_name: document.getElementById('editFullName').value,
            email: document.getElementById('editEmail').value,
            phone: document.getElementById('editPhone').value,
            passport: document.getElementById('editPassport').value
        };
        
        for (let field in formData) {
            if (!formData[field]) {
                this.showError('Заполните все поля');
                return;
            }
        }
        
        try {
            const response = await fetch('/api/user/profile', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify(formData)
            });
            
            const result = await response.json();
            
            if (result.success) {
                this.currentUser = { ...this.currentUser, ...formData };
                this.updateProfileButton();
                this.showProfileView();
                this.showSuccess('Профиль успешно обновлен!');
            } else {
                this.showError(result.error || 'Ошибка обновления профиля');
            }
        } catch (error) {
            this.showError('Ошибка соединения с сервером');
        }
    }

    async handleChangePassword(e) {
        e.preventDefault();
        
        const currentPassword = document.getElementById('currentPassword').value;
        const newPassword = document.getElementById('newPassword').value;
        const confirmPassword = document.getElementById('confirmPassword').value;
        
        if (!currentPassword || !newPassword || !confirmPassword) {
            this.showError('Заполните все поля');
            return;
        }
        
        if (newPassword !== confirmPassword) {
            this.showError('Новые пароли не совпадают');
            return;
        }
        
        if (newPassword.length < 6) {
            this.showError('Пароль должен быть не менее 6 символов');
            return;
        }
        
        try {
            const response = await fetch('/api/user/password', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({
                    currentPassword: currentPassword,
                    newPassword: newPassword
                })
            });
            
            const result = await response.json();
            
            if (result.success) {
                document.getElementById('passwordForm').reset();
                this.showProfileView();
                this.showSuccess('Пароль успешно изменен!');
            } else {
                this.showError(result.error || 'Ошибка смены пароля');
            }
        } catch (error) {
            this.showError('Ошибка соединения с сервером');
        }
    }

    logout() {
        localStorage.removeItem('token');
        this.currentUser = null;
        this.updateProfileButton();
        document.getElementById('profilePopup').style.display = 'none';
        this.showSuccess('Вы вышли из системы');
    }
}

const travelApp = new TravelApp();
document.addEventListener('DOMContentLoaded', function() {
    travelApp.init();
});