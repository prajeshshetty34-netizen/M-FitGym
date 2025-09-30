document.getElementById("bmiForm").addEventListener("submit", function(e) {
  e.preventDefault();

  let height = parseFloat(document.getElementById("height").value);
  let weight = parseFloat(document.getElementById("weight").value);

  if (height > 0 && weight > 0) {
    let bmi = (weight / ((height / 100) ** 2)).toFixed(2);
    let status = "";

    if (bmi < 18.5) status = "Underweight";
    else if (bmi < 24.9) status = "Normal weight";
    else if (bmi < 29.9) status = "Overweight";
    else status = "Obese";

    document.getElementById("result").innerHTML = `Your BMI is <strong>${bmi}</strong> (${status})`;
  } else {
    document.getElementById("result").innerText = "Please enter valid height and weight!";
  }
});
