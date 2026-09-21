// التحكم في الـ Hero Slider
let current = 0;
const slides = document.querySelectorAll('.slide');
const dots = document.querySelectorAll('.dot');

function goSlide(n) {
  if (!slides.length || !dots.length) return;
  slides[current].classList.remove('active');
  dots[current].classList.remove('active');
  current = (n + slides.length) % slides.length;
  slides[current].classList.add('active');
  dots[current].classList.add('active');
}

function goToSlide(n) { goSlide(n); }
function nextSlide() { goSlide(current + 1); }
function prevSlide() { goSlide(current - 1); }

if (slides.length) setInterval(nextSlide, 4000);
