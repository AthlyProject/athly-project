package com.athly.runner.core.designsystem.component

import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import com.athly.runner.core.designsystem.theme.AthlyColor
import com.athly.runner.core.designsystem.theme.AthlyType
import com.athly.runner.core.navigation.AppTab

private val TabBarShape = RoundedCornerShape(20.dp)

/**
 * Barra de navegação flutuante — espelha `FloatingTabBar` do iOS: 5 abas (ícone + título empilhados),
 * ícone do Run maior (22 vs 18), selecionado em `primary` senão `textTertiary` (troca animada 0.2s),
 * fundo `surfaceDark @0.95` translúcido, cantos 20, borda glassBorder, sombra. Insets horizontais 16.
 */
@Composable
fun FloatingTabBar(
    selected: AppTab,
    onSelect: (AppTab) -> Unit,
    modifier: Modifier = Modifier,
) {
    Row(
        modifier = modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp)
            .shadow(elevation = 12.dp, shape = TabBarShape, clip = false, spotColor = Color.Black, ambientColor = Color.Black)
            .clip(TabBarShape)
            .background(AthlyColor.surfaceDark.copy(alpha = 0.95f))
            .border(1.dp, AthlyColor.glassBorder, TabBarShape)
            .padding(vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        AppTab.entries.forEach { tab ->
            TabBarItem(
                tab = tab,
                selected = tab == selected,
                onClick = { onSelect(tab) },
                modifier = Modifier.weight(1f),
            )
        }
    }
}

@Composable
private fun TabBarItem(
    tab: AppTab,
    selected: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val color by animateColorAsState(
        targetValue = if (selected) AthlyColor.primary else AthlyColor.textTertiary,
        animationSpec = tween(200),
        label = "tabColor",
    )
    Column(
        modifier = modifier.clickable(
            interactionSource = remember { MutableInteractionSource() },
            indication = null,
            onClick = onClick,
        ),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(4.dp),
    ) {
        Icon(
            imageVector = tab.icon,
            contentDescription = tab.title,
            tint = color,
            modifier = Modifier.size(if (tab.isRun) 22.dp else 18.dp),
        )
        Text(text = tab.title, style = AthlyType.label, color = color)
    }
}
