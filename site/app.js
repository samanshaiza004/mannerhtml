const demoFrame = document.querySelector("[data-progressive-demo]");
const demoToggle = document.querySelector("[data-demo-toggle]");

if (demoFrame && demoToggle) {
  const updateDemo = () => {
    demoFrame.src = demoToggle.checked ? "./progressive-demo.html" : "./progressive-demo.html?nojs=1";
  };
  demoToggle.addEventListener("change", updateDemo);
  updateDemo();
}
