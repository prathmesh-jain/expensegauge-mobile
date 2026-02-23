//expenseapi.ts
import api from "./api"; // your axios instance
import { Toast } from "toastify-react-native";

export type Transaction = {
    _id: string;
    amount: number;
    date: string;
    details: string;
    type: string;
    category: string;
    isSynced: boolean;
    clientId?: string;
};


// -------------------- USER APIs --------------------

// Add new expense (user)
export const addExpenseApi = async (data: Transaction) => {
    try {
        const response = await api.post("/expense/add", {
            ...data,
            clientId: data.clientId || data._id
        }, {
            headers: {
                "x-meta": JSON.stringify({
                    localId: data._id,
                    type: "expense",
                    action: "add",
                }),
            },
        });


        if (response.data.offline) {
            Toast.info("Offline — expense will sync later.");
            return null;
        }

        return response.data.id; // backend-assigned ID
    } catch (error: any) {
        console.error("Error adding expense:", error.message);
        return null;
    }
};

// Edit expense (user)
export const editExpenseApi = async (data: Transaction) => {
    try {
        await api.patch(`/expense/${data._id}`, data, {
            headers: {
                "x-meta": JSON.stringify({
                    localId: data._id,
                    type: "expense",
                    action: "edit",
                }),
            },
        });
    } catch (error) {
        console.error("Error editing expense:", error);
    }
};

// -------------------- ADMIN APIs --------------------

// Edit user expense as admin
export const editUserExpenseAdminApi = async (userId: string, data: Transaction) => {
    try {
        await api.patch(`/admin/expense/${userId}/${data._id}`, data, {
            headers: {
                "x-meta": JSON.stringify({
                    localId: data._id,
                    userId,
                    type: "admin_expense",
                    action: "edit",
                }),
            },
        });
    } catch (error) {
        console.error("Error editing user expense (admin):", error);
    }
};

// Assign balance to user
export const assignBalanceApi = async (userId: string, details: string, date: string, amount: number, localId?: string) => {
    try {
        const tempId = localId || Date.now().toString();
        const response = await api.post(`/admin/assignBalance/${userId}`, {
            details,
            date,
            amount,
        }, {
            headers: {
                "x-meta": JSON.stringify({
                    localId: tempId,
                    userId,
                    type: "admin_balance",
                    action: "add",
                }),
            },
        });

        if (response.data.offline) return tempId;
        return response.data.id;
    } catch (error) {
        console.error(error);
    }
};
