import "./styles.css";
import PenisVMClient from "./utils/PenisVMClient";
import VM from "./utils/vm";

import { vmUrls } from "./config";
import { ClientRank } from "./utils/user";

const elements = {
  mainContent: document.querySelector(".content") as HTMLDivElement,
};

const vms: VM[] = [];

const getVMInfo = () => {
  return new Promise<void>(async (res) => {
    for (const PenisVMServer of vmUrls) {
      const client = new PenisVMClient(PenisVMServer);

      await client.waitUntilConnectionOpen();
      const vmInfo = await client.listVM();
      client.close();

      vms.push(vmInfo);
    }

    res();
  });
};

declare global {
  interface Window {
    PenisVM: any;
  }
}

const listVMs = () => {
  elements.mainContent.innerHTML = ``;

  const vmList = document.createElement("div");
  vmList.classList.add("vm-list");

  console.log("[listVMs] loading vms...");

  for (const vm of vms) {
    const vmCard = document.createElement("div");
    vmCard.classList.add("vm-card");

    vmCard.appendChild(vm.thumbnail);

    const vmCardContent = document.createElement("div");
    let vmDescription: string;
    vmCardContent.classList.add("vm-card-content");

    if (vm.description !== "") {
      vmDescription = `
            <div class="vm-desc">${vm.description}</div>
        `;
    } else {
      vmDescription = ``;
    }

    vmCardContent.innerHTML = `
        <h3>${vm.name}</h3>${vmDescription}
    `;

    vmCard.appendChild(vmCardContent);
    vmCard.addEventListener("click", () => connectToVM(vm.url));

    vmList.appendChild(vmCard);

    console.log(`[listVMs] loaded "${vm.name}"`);
  }

  elements.mainContent.appendChild(vmList);
};

const connectToVM = async (url: string) => {
    elements.mainContent.innerHTML = ``;

    const client = new PenisVMClient(url);

    const vm = document.createElement("div");
    vm.classList.add("vm");

    const vmContent = document.createElement("div");
    vmContent.classList.add("vm-content");

    const vmSidebar = document.createElement("div");
    vmSidebar.classList.add("vm-sidebar");

    const displayContainer = document.createElement("div");
    displayContainer.classList.add("display-container");

    const bottomInfo = document.createElement("div");
    bottomInfo.classList.add("bottom-info");

    vmContent.appendChild(displayContainer);
    vmContent.appendChild(bottomInfo);
    vm.appendChild(vmContent);
    vm.appendChild(vmSidebar);

    await client.waitUntilConnectionOpen();
    await client.connect("rgb");

    client.on("turnUpdate", (ourTurn, secondsRemaining?, queueSize?) => {
        if (ourTurn) {
            bottomInfo.innerHTML = `<span>it's your turn! <b>${secondsRemaining} seconds remaining...</b></span>`;
        } else if (typeof secondsRemaining == "undefined") {
            bottomInfo.innerHTML = `<span>hey! click the VM screen to take a turn. (${queueSize} people in the queue)</span>`;
        } else {
            bottomInfo.innerHTML = `<span>there are <b>${secondsRemaining} seconds remaining</b> with <b>${queueSize} people in the queue</b>...</span>`;
        }
    });

    displayContainer.appendChild(client!.display);
    elements.mainContent.appendChild(vm);
};

await getVMInfo();
listVMs();

window.PenisVM = {};