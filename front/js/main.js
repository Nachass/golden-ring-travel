class AdminPanel {
    constructor() {
        this.tours = [];
        this.cities = [
            { id: 1, name: 'Сергиев Посад' },
            { id: 2, name: 'Переславль-Залесский' },
            { id: 3, name: 'Ростов Великий' },
            { id: 4, name: 'Ярославль' },
            { id: 5, name: 'Кострома' },
            { id: 6, name: 'Иваново' },
            { id: 7, name: 'Суздаль' },
            { id: 8, name: 'Владимир' }
        ];
        this.currentTheme = 'light';
        this.init();
    }

    init() {
        this.loadTheme();
        this.checkAuth();
        this.bindEvents();
        this.loadExistingTours();
    }

    loadTheme() {
        const savedTheme = localStorage.getItem('adminTheme') || 'light';
        this.setTheme(savedTheme);
    }

    setTheme(theme) {
        this.currentTheme = theme;
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('adminTheme', theme);
        
        const themeBtn = document.getElementById('themeToggleBtn');
        if (themeBtn) {
            themeBtn.textContent = theme === 'dark' ? '☀️ Светлая' : '🌙 Тёмная';
        }
    }

    toggleTheme() {
        const newTheme = this.currentTheme === 'light' ? 'dark' : 'light';
        this.setTheme(newTheme);
    }

    checkAuth() {
        const token = localStorage.getItem('adminToken');
        if (!token) {
            alert('Доступ запрещен. Требуется авторизация.');
            window.location.href = 'index.html';
            return;
        }
    }

    bindEvents() {
        document.getElementById('addTourForm').addEventListener('submit', (e) => this.handleAddTour(e));
        document.getElementById('editTourForm').addEventListener('submit', (e) => this.handleEditTour(e));
        
        document.getElementById('editTourPopup').addEventListener('click', (e) => {
            if (e.target.id === 'editTourPopup') {
                this.closeEditPopup();
            }
        });
    }

    async handleAddTour(e) {
        e.preventDefault();
        
        const formData = {
            city_id: document.getElementById('tourCity').value,
            title: document.getElementById('tourTitle').value,
            description: document.getElementById('tourDescription').value,
            full_description: document.getElementById('tourFullDescription').value,
            price: document.getElementById('tourPrice').value,
            duration_days: document.getElementById('tourDuration').value,
            available_seats: document.getElementById('tourSeats').value,
            image_url: document.getElementById('tourImage').value || null
        };

        if (!formData.city_id || !formData.title || !formData.description || !formData.full_description || !formData.price || !formData.duration_days || !formData.available_seats) {
            alert('Заполните все обязательные поля');
            return;
        }

        const submitBtn = e.target.querySelector('button[type="submit"]');
        const originalText = submitBtn.textContent;
        submitBtn.textContent = 'Добавление...';
        submitBtn.disabled = true;

        try {
            const token = localStorage.getItem('adminToken');
            const response = await fetch('/api/admin/tours', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(formData)
            });

            const result = await response.json();

            if (result.success) {
                alert('Тур успешно добавлен!');
                e.target.reset();
                this.loadExistingTours();
            } else {
                alert(result.error || 'Ошибка добавления тура');
            }
        } catch (error) {
            console.error('Ошибка добавления тура:', error);
            alert('Ошибка соединения с сервером');
        } finally {
            submitBtn.textContent = originalText;
            submitBtn.disabled = false;
        }
    }

    async handleEditTour(e) {
        e.preventDefault();
        
        const tourId = document.getElementById('editTourId').value;
        const formData = {
            city_id: document.getElementById('editTourCity').value,
            title: document.getElementById('editTourTitle').value,
            description: document.getElementById('editTourDescription').value,
            full_description: document.getElementById('editTourFullDescription').value,
            price: document.getElementById('editTourPrice').value,
            duration_days: document.getElementById('editTourDuration').value,
            available_seats: document.getElementById('editTourSeats').value,
            image_url: document.getElementById('editTourImage').value || null
        };

        if (!formData.city_id || !formData.title || !formData.description || !formData.full_description || !formData.price || !formData.duration_days || !formData.available_seats) {
            alert('Заполните все обязательные поля');
            return;
        }

        const submitBtn = e.target.querySelector('button[type="submit"]');
        const originalText = submitBtn.textContent;
        submitBtn.textContent = 'Сохранение...';
        submitBtn.disabled = true;

        try {
            const token = localStorage.getItem('adminToken');
            const response = await fetch(`/api/admin/tours/${tourId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(formData)
            });

            const result = await response.json();

            if (result.success) {
                alert('Тур успешно обновлен!');
                this.closeEditPopup();
                this.loadExistingTours();
            } else {
                alert(result.error || 'Ошибка обновления тура');
            }
        } catch (error) {
            console.error('Ошибка обновления тура:', error);
            alert('Ошибка соединения с сервером');
        } finally {
            submitBtn.textContent = originalText;
            submitBtn.disabled = false;
        }
    }

    openEditPopup(tourId) {
        const tour = this.tours.find(t => t.id === tourId);
        if (!tour) return;

        document.getElementById('editTourId').value = tour.id;
        document.getElementById('editTourCity').value = tour.city_id;
        document.getElementById('editTourTitle').value = tour.title;
        document.getElementById('editTourDescription').value = tour.description;
        document.getElementById('editTourFullDescription').value = tour.full_description;
        document.getElementById('editTourPrice').value = tour.price;
        document.getElementById('editTourDuration').value = tour.duration_days;
        document.getElementById('editTourSeats').value = tour.available_seats;
        document.getElementById('editTourImage').value = tour.image_url || '';

        document.getElementById('editTourPopup').style.display = 'block';
    }

    closeEditPopup() {
        document.getElementById('editTourPopup').style.display = 'none';
        document.getElementById('editTourForm').reset();
    }

    async loadExistingTours() {
        try {
            const container = document.getElementById('existingTours');
            container.innerHTML = '<div class="loading">Загрузка туров...</div>';

            const token = localStorage.getItem('adminToken');
            const response = await fetch('/api/admin/tours', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok) {
                throw new Error('Ошибка загрузки туров');
            }

            this.tours = await response.json();
            this.renderTours();

        } catch (error) {
            console.error('Ошибка загрузки туров:', error);
            document.getElementById('existingTours').innerHTML = 
                '<div class="empty-state">Ошибка загрузки туров</div>';
        }
    }

    renderTours() {
        const container = document.getElementById('existingTours');
        
        if (this.tours.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <p>Туры еще не добавлены</p>
                    <p>Добавьте первый тур используя форму слева</p>
                </div>
            `;
            return;
        }

        container.innerHTML = this.tours.map(tour => `
            <div class="tour-item">
                <h3>${tour.title}</h3>
                <p><strong>Город:</strong> ${this.getCityName(tour.city_id)}</p>
                <p><strong>Описание:</strong> ${tour.description}</p>
                <p><strong>Полное описание:</strong> ${tour.full_description}</p>
                
                <div class="tour-meta">
                    <div>
                        <p><strong>Цена:</strong> ${tour.price} ₽</p>
                        <p><strong>Длительность:</strong> ${tour.duration_days} дней</p>
                        <p><strong>Доступно мест:</strong> ${tour.available_seats}</p>
                        <p><strong>Дата создания:</strong> ${new Date(tour.created_at).toLocaleDateString()}</p>
                    </div>
                    <div class="tour-status ${tour.is_active ? 'status-active' : 'status-inactive'}">
                        ${tour.is_active ? 'Активен' : 'Неактивен'}
                    </div>
                </div>
                
                ${tour.image_url ? `<p><strong>Изображение:</strong> ${tour.image_url}</p>` : ''}
                
                <div class="tour-actions">
                    <button class="edit-btn" onclick="adminPanel.openEditPopup(${tour.id})">
                        Редактировать
                    </button>
                    <button class="delete-btn" onclick="adminPanel.deleteTour(${tour.id})">
                        Удалить
                    </button>
                </div>
            </div>
        `).join('');
    }

    getCityName(cityId) {
        const city = this.cities.find(c => c.id == cityId);
        return city ? city.name : 'Неизвестный город';
    }

    async deleteTour(tourId) {
        const tour = this.tours.find(t => t.id === tourId);
        if (!tour) return;

        if (confirm(`Вы уверены, что хотите удалить тур "${tour.title}"?`)) {
            try {
                const token = localStorage.getItem('adminToken');
                const response = await fetch(`/api/admin/tours/${tourId}`, {
                    method: 'DELETE',
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });

                if (response.ok) {
                    this.tours = this.tours.filter(t => t.id !== tourId);
                    this.renderTours();
                    alert(`Тур "${tour.title}" удален`);
                } else {
                    const result = await response.json();
                    alert(result.error || 'Ошибка удаления тура');
                }
            } catch (error) {
                console.error('Ошибка удаления тура:', error);
                alert('Ошибка соединения с сервером');
            }
        }
    }

    logout() {
        if (confirm('Вы уверены, что хотите выйти из админ панели?')) {
            localStorage.removeItem('adminToken');
            window.location.href = 'index.html';
        }
    }
}

const adminPanel = new AdminPanel();