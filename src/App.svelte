<script>
	import Keypad from './Keypad.svelte';
	let chislo1 =0
	let chislo2 = 0 
	let pin;
	let pin1
	let sum
	$: view = pin ? pin : 'введите число 1';
	$: view1 = pin1 ? pin1 : 'введите число 2';
function handleSubmit() {	}
function handleSum(){
	chislo1 =pin  
		console.log(chislo1);
		chislo2= pin1
		console.log(chislo2);
	sum=Number(chislo1)+Number(chislo2)
}

function handleMinus(){
	chislo1 =pin  
		console.log(chislo1);
		chislo2= pin1
		console.log(chislo2);
	sum=Number(chislo1)-Number(chislo2)
}
function handleUmno(){
	chislo1 =pin  
		console.log(chislo1);
		chislo2= pin1
		console.log(chislo2);
	sum=Number(chislo1)*Number(chislo2)
}
function handleDel(){
	chislo1 =pin  
		console.log(chislo1);
		chislo2= pin1
		console.log(chislo2);
	sum=Number(chislo1)/Number(chislo2)
}



</script>

<input class="input1" style="color: {pin ? '#333' : '#ccc'}" value={view}>
<Keypad bind:value={pin} on:click={handleSubmit}/>

<input class="input2" style="color: {pin1 ? '#333' : '#ccc'}" value={view1}>
<Keypad bind:value={pin1} on:click={handleSubmit}/>


<button on:click={handleSum}>+</button>
<button on:click={handleMinus}>-</button>
<button on:click={handleUmno}>*</button>
<button on:click={handleDel}>/</button>
<br>
<input type="text"  value={sum} class="sum">